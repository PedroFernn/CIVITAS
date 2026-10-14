import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { nuevaConfig } from '../src/etl/config';
import { correrMvp2 } from '../src/etl/pipeline';
import { prepararBdPruebas, TEST_DB_URL } from './helpers/db';

/**
 * Contra PostGIS real: carga los datos sintéticos con el propio ETL (igual que en producción) y prueba la API encima.
 * Se omite sólo si no hay servidor PostGIS (y falla con REQUIRE_DB=1, que fijan CI y el contenedor `test`).
 */
describe('API MVP-2 (PostGIS real)', () => {
  let app: INestApplication | undefined;
  let listo = false;

  beforeAll(async () => {
    listo = await prepararBdPruebas();
    if (!listo) return;
    process.env.DATABASE_URL = TEST_DB_URL;
    expect(await correrMvp2(nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest' }), true, true)).toBe(true);
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  }, 120_000);
  afterAll(async () => { await app?.close(); });

  it('lista ≥30 zonas piloto con conteos y trazabilidad', async () => {
    if (!listo) return;
    const r = await request(app!.getHttpServer()).get('/colonias?limit=200').expect(200);
    expect(r.body.total).toBeGreaterThanOrEqual(30);
    for (const z of r.body.items) {
      expect(typeof z.num_comercios).toBe('number');
      expect(typeof z.num_paradas).toBe('number');
      expect(z.fuente_geom).toBe('inegi_mgn');
      expect(z.fecha_carga).toBeTruthy();
    }
  });

  it('GeoJSON: todos los polígonos son válidos y no vacíos', async () => {
    if (!listo) return;
    const r = await request(app!.getHttpServer()).get('/colonias/geojson?limit=500').expect(200);
    expect(r.body.features.length).toBeGreaterThanOrEqual(30);
    for (const f of r.body.features) expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type);
  });

  it('detalle de una zona y 404 de una inexistente', async () => {
    if (!listo) return;
    const lista = await request(app!.getHttpServer()).get('/colonias?limit=1').expect(200);
    const d = await request(app!.getHttpServer()).get(`/colonias/${lista.body.items[0].id}`).expect(200);
    expect(d.body.geometry.type).toMatch(/Polygon/);
    await request(app!.getHttpServer()).get('/colonias/5b0fd1a2-0000-4000-8000-000000000000').expect(404);
  });

  it('filtro por bbox y por mínimo de paradas', async () => {
    if (!listo) return;
    const todo = await request(app!.getHttpServer()).get('/colonias?limit=200').expect(200);
    const vacio = await request(app!.getHttpServer()).get('/colonias?bbox=-90,10,-89,11').expect(200);
    expect(vacio.body.total).toBe(0);
    const conParadas = await request(app!.getHttpServer()).get('/colonias?min_paradas=1&limit=200').expect(200);
    expect(conParadas.body.items.every((z: any) => z.num_paradas >= 1)).toBe(true);
    expect(conParadas.body.total).toBeLessThanOrEqual(todo.body.total);
  });

  it('tile MVT con contenido sobre el centro de Puebla (z=14)', async () => {
    if (!listo) return;
    // Tile que contiene 19.04N, -98.21W a z=14
    const z = 14, lat = 19.04 * Math.PI / 180;
    const x = Math.floor(((-98.21 + 180) / 360) * 2 ** z);
    const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * 2 ** z);
    const r = await request(app!.getHttpServer()).get(`/tiles/colonias/${z}/${x}/${y}.mvt`).buffer(true).parse((res, cb) => {
      const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c)));
    }).expect(200);
    expect((r.body as Buffer).length).toBeGreaterThan(0);
  });

  it('trazabilidad y validación publicadas', async () => {
    if (!listo) return;
    const f = await request(app!.getHttpServer()).get('/datos-abiertos/fuentes').expect(200);
    expect(f.body.map((x: any) => x.clave)).toEqual(expect.arrayContaining(['inegi_mgn', 'inegi_denue', 'transporte_paradas']));
    const c = await request(app!.getHttpServer()).get('/datos-abiertos/cargas?fuente=inegi_denue').expect(200);
    expect(c.body[0].sha256).toHaveLength(64);
    const v = await request(app!.getHttpServer()).get('/datos-abiertos/validacion').expect(200);
    expect(v.body.aprobada).toBe(true);
  });
});
