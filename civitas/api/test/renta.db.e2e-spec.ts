import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { nuevaConfig } from '../src/etl/config';
import { correrMvp2 } from '../src/etl/pipeline';
import { correrMvp3 } from '../src/etl/renta/pipeline';
import { prepararBdPruebas, TEST_DB_URL } from './helpers/db';

/** API de MVP-3 sobre PostGIS real, con los datos que carga el propio ETL (igual que en producción). */
describe('API MVP-3 (PostGIS real)', () => {
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

  it('lista listados normalizados, sin ningún campo personal', async () => {
    if (!listo) return;
    const r = await http().get('/listados-renta?limit=200').expect(200);
    expect(r.body.total).toBeGreaterThanOrEqual(300);
    for (const l of r.body.items) {
      expect(Object.keys(l).sort()).toEqual(['fuente_clave', 'id', 'id_fuente', 'lat', 'lon', 'modo_datos', 'precio_m2', 'precio_mxn', 'publicado_en',
        'recamaras', 'superficie_m2', 'tipo_inmueble', 'url', 'zona_clave_geo', 'zona_id', 'zona_nombre']);
      expect(typeof l.precio_mxn).toBe('number');
      expect(l.modo_datos).toBe('fixture');
    }
    expect(JSON.stringify(r.body)).not.toMatch(/telefono|anunciante/i);
  });

  it('filtros: con_zona, tipo, recámaras, rango de precio, zona y orden', async () => {
    if (!listo) return;
    const sin = await http().get('/listados-renta?con_zona=false&limit=200').expect(200);
    expect(sin.body.total).toBeGreaterThanOrEqual(1);
    expect(sin.body.items.every((l: any) => l.zona_id === null)).toBe(true);
    const casas = await http().get('/listados-renta?tipo=casa&recamaras=3&min_precio=8000&max_precio=20000&limit=200').expect(200);
    expect(casas.body.items.every((l: any) => l.tipo_inmueble === 'casa' && l.recamaras === 3 && l.precio_mxn >= 8000 && l.precio_mxn <= 20000)).toBe(true);
    const caros = await http().get('/listados-renta?orden=precio&limit=5').expect(200);
    const precios = caros.body.items.map((l: any) => l.precio_mxn);
    expect(precios).toEqual([...precios].sort((a, b) => b - a));
    const zona = (await http().get('/listados-renta?con_zona=true&limit=1').expect(200)).body.items[0].zona_id;
    const deZona = await http().get(`/listados-renta?zona_id=${zona}&limit=200`).expect(200);
    expect(deZona.body.items.every((l: any) => l.zona_id === zona)).toBe(true);
  });

  it('resumen por zona: estadísticas solo con ≥5 listados', async () => {
    if (!listo) return;
    const r = await http().get('/listados-renta/resumen-zonas?limit=500').expect(200);
    expect(r.body.min_listados_estadistica).toBe(5);
    expect(r.body.items.length).toBeGreaterThan(0);
    for (const z of r.body.items) {
      if (z.n_listados < 5) { expect(z.estadistica_suprimida).toBe(true); expect(z.renta_mediana).toBeNull(); }
      else { expect(z.estadistica_suprimida).toBe(false); expect(z.renta_p25).toBeLessThanOrEqual(z.renta_mediana); expect(z.renta_mediana).toBeLessThanOrEqual(z.renta_p75); }
    }
    expect(r.body.items.reduce((s: number, z: any) => s + z.n_listados, 0)).toBeGreaterThanOrEqual(300);
  });

  it('publica el reporte de calidad y el checklist aprobado', async () => {
    if (!listo) return;
    const c = await http().get('/listados-renta/calidad').expect(200);
    expect(c.body.campos_clave.tasa_nulos).toBeLessThan(0.1);
    expect(c.body.totales.descartados).toBe(19);
    expect(c.body.modo).toBe('fixture');
    const v = await http().get('/listados-renta/validacion').expect(200);
    expect(v.body.aprobada).toBe(true);
    expect(v.body.resultados.map((x: any) => x.id)).toEqual(expect.arrayContaining(
      ['listados_con_zona', 'campos_clave_nulos', 'reporte_calidad', 'decision_fuente', 'legalidad_terminos', 'privacidad', 'parser_por_fuente', 'deduplicacion']));
  });

  it('la fuente aparece en el catálogo de datos abiertos', async () => {
    if (!listo) return;
    const f = await http().get('/datos-abiertos/fuentes').expect(200);
    const renta = f.body.find((x: any) => x.clave === 'renta_captura_manual');
    expect(renta).toMatchObject({ estado: 'ok', modo: 'fixture' });
    expect(renta.registros_descartados).toBe(19);
  });
});
