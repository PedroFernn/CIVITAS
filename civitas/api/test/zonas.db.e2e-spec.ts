import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { nuevaConfig } from '../src/etl/config';
import { conectar } from '../src/etl/db';
import { correrMvp2 } from '../src/etl/pipeline';
import { correrMvp3 } from '../src/etl/renta/pipeline';
import { medianaManual } from '../src/etl/mvp4/validacion';
import { prepararBdPruebas, TEST_DB_URL } from './helpers/db';

/** API del catálogo sobre PostGIS real, con los datos que cargan MVP-2 y MVP-3. */
describe('API MVP-4 · zonas (PostGIS real)', () => {
  let app: INestApplication | undefined;
  let listo = false;
  const http = () => request(app!.getHttpServer());

  beforeAll(async () => {
    listo = await prepararBdPruebas();
    if (!listo) return;
    process.env.DATABASE_URL = TEST_DB_URL;
    const cfg = nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest' });
    expect(await correrMvp2(cfg, true, true)).toBe(true);
    expect(await correrMvp3(cfg)).toBe(true);
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  }, 180_000);
  afterAll(async () => { await app?.close(); });

  it('lista: 30 zonas piloto, con mediana solo donde hay ≥5 listados', async () => {
    if (!listo) return;
    const r = await http().get('/zonas?limit=200').expect(200);
    expect(r.body.total).toBe(30);
    for (const z of r.body.items) {
      if (z.n_listados < 5) { expect(z.estadistica_suprimida).toBe(true); expect(z.renta_mediana).toBeNull(); expect(z.renta_p25).toBeNull(); }
      else expect(z.renta_mediana).toBeGreaterThan(0);
      if (z.n_precio_m2 < 5) expect(z.precio_m2_mediano).toBeNull();
    }
  });

  it('ordenar por renta pone las suprimidas al final y el resto de mayor a menor', async () => {
    if (!listo) return;
    const r = await http().get('/zonas?orden=renta&limit=200').expect(200);
    const rentas = r.body.items.map((z: any) => z.renta_mediana);
    const conDato = rentas.filter((x: number | null) => x !== null);
    expect(conDato).toEqual([...conDato].sort((a: number, b: number) => b - a));
    expect(rentas.slice(0, conDato.length).every((x: number | null) => x !== null)).toBe(true);   // los nulos van después
  });

  it('con_precio y rango de renta filtran sin dejar pasar zonas suprimidas', async () => {
    if (!listo) return;
    const todas = (await http().get('/zonas?con_precio=true&limit=200').expect(200)).body.items;
    expect(todas.length).toBeGreaterThan(0);
    expect(todas.every((z: any) => z.renta_mediana !== null)).toBe(true);
    const med = [...todas.map((z: any) => z.renta_mediana)].sort((a, b) => a - b)[Math.floor(todas.length / 2)];
    const caras = (await http().get(`/zonas?min_renta=${Math.floor(med)}&limit=200`).expect(200)).body.items;
    expect(caras.length).toBeGreaterThan(0);
    expect(caras.every((z: any) => z.renta_mediana >= Math.floor(med))).toBe(true);
  });

  it('buscar: encuentra por palabra sin acento, por CVEGEO parcial y por número suelto', async () => {
    if (!listo) return;
    const sin = (await http().get('/zonas/buscar?q=sintetico&limit=20').expect(200)).body;
    expect(sin.total).toBe(30);
    expect(sin.items).toHaveLength(20);
    const una = (await http().get('/zonas/buscar?q=4').expect(200)).body.items[0];
    expect(una.nombre).toMatch(/ 04$/);                              // «4» → «04» primero
    const clave = una.clave_geo as string;
    const porClave = (await http().get(`/zonas/buscar?q=${clave}`).expect(200)).body.items[0];
    expect(porClave.id).toBe(una.id);
    const parcial = (await http().get(`/zonas/buscar?q=${clave.slice(0, 9)}`).expect(200)).body;
    expect(parcial.total).toBeGreaterThanOrEqual(1);
    expect((await http().get('/zonas/buscar?q=zzzzzz').expect(200)).body.total).toBe(0);
  });

  it('ficha: la mediana por m² coincide con el cálculo manual (RF-1.1) y trae referencia, posición y trazabilidad', async () => {
    if (!listo) return;
    const lista = (await http().get('/zonas?orden=listados&limit=3').expect(200)).body.items;
    const conn = await conectar(TEST_DB_URL);
    try {
      for (const z of lista) {
        const f = (await http().get(`/zonas/${z.id}`).expect(200)).body;
        const m2 = (await conn.query('SELECT precio_m2::float AS v FROM listados_renta WHERE zona_id = $1 AND precio_m2 IS NOT NULL', [z.id])).map((r) => r.v);
        const rt = (await conn.query('SELECT precio_mxn::float AS v FROM listados_renta WHERE zona_id = $1', [z.id])).map((r) => r.v);
        expect(f.renta.precio_m2_mediano).toBeCloseTo(medianaManual(m2)!, 2);
        expect(f.renta.mediana).toBeCloseTo(medianaManual(rt)!, 2);
        expect(f.ciudad_referencia.renta_mediana).toBeGreaterThan(0);
        expect(f.renta.posicion_precio_m2.lugar).toBeGreaterThanOrEqual(1);
        expect(f.trazabilidad.modo_datos).toBe('fixture');
        expect(f.listados_recientes.length).toBeLessThanOrEqual(6);
        expect(JSON.stringify(f)).not.toMatch(/telefono|anunciante/i);
        expect(f.geometry.type).toMatch(/Polygon/);
      }
    } finally { await conn.close(); }
  });

  it('ficha de una zona con pocos listados: sin medianas, pero con sus datos', async () => {
    if (!listo) return;
    const chica = (await http().get('/zonas?orden=listados&limit=200').expect(200)).body.items.find((z: any) => z.n_listados < 5);
    if (!chica) return;
    const f = (await http().get(`/zonas/${chica.id}`).expect(200)).body;
    expect(f.renta).toMatchObject({ estadistica_suprimida: true, mediana: null, p25: null, precio_m2_mediano: null, posicion_precio_m2: null });
    expect(f.num_comercios).toBeGreaterThanOrEqual(0);
  });

  it('geojson: una feature por zona con las mismas propiedades que la lista', async () => {
    if (!listo) return;
    const g = (await http().get('/zonas/geojson').expect(200)).body;
    expect(g.features).toHaveLength(30);
    expect(g.features[0].geometry.type).toMatch(/Polygon/);
    expect(g.features[0].properties).toHaveProperty('renta_mediana');
  });
});
