import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';

/** Pruebas e2e con BD simulada: validan contrato HTTP, validación de entrada y que todo vaya parametrizado. */
describe('API MVP-2 (BD simulada)', () => {
  let app: INestApplication;
  const llamadas: { sql: string; params: unknown[] }[] = [];
  let respuesta: any[] = [];
  const fakeDb = { query: jest.fn(async (sql: string, params: unknown[] = []) => { llamadas.push({ sql, params }); return respuesta; }), onModuleDestroy: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(fakeDb).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => { llamadas.length = 0; respuesta = []; });

  it('GET /health responde ok con la versión de PostGIS', async () => {
    respuesta = [{ postgis: '3.4' }];
    const r = await request(app.getHttpServer()).get('/health').expect(200);
    expect(r.body).toEqual({ status: 'ok', postgis: '3.4' });
  });

  it('GET /colonias devuelve conteos de comercios y paradas (RF-1.1) y el total paginado', async () => {
    respuesta = [{ id: 'a', nombre: 'AGEB 1', num_comercios: 12, num_paradas: 3, total: 30 }];
    const r = await request(app.getHttpServer()).get('/colonias?ciudad=Puebla&min_comercios=5&orden=comercios&limit=10').expect(200);
    expect(r.body.total).toBe(30);
    expect(r.body.items[0]).toMatchObject({ num_comercios: 12, num_paradas: 3 });
    expect(r.body.items[0].total).toBeUndefined();
    const { sql, params } = llamadas[0];
    expect(params).toEqual(['Puebla', 5, 10, 0]);
    expect(sql).toContain('c.es_piloto');                 // por defecto solo piloto
    expect(sql).not.toContain('Puebla');                  // nada interpolado en el SQL
  });

  it('piloto=false quita el filtro de piloto', async () => {
    await request(app.getHttpServer()).get('/colonias?piloto=false').expect(200);
    expect(llamadas[0].sql).not.toContain('WHERE c.es_piloto');
  });

  it.each([
    ['/colonias?limit=1000'], ['/colonias?limit=abc'], ['/colonias?orden=precio;DROP TABLE colonias'],
    ['/colonias?bbox=1,2,3'], ['/colonias?bbox=-98,19,-99,20'], ['/colonias?piloto=quizas'], ['/colonias?min_comercios=-1'],
    ['/colonias/no-es-uuid'], ['/tiles/colonias/30/0/0.mvt'], ['/tiles/colonias/2/9/0.mvt'], ['/tiles/colonias/a/0/0.mvt'],
    ['/datos-abiertos/cargas?limit=0'],
  ])('rechaza entrada inválida: %s → 400', async (url) => {
    await request(app.getHttpServer()).get(url).expect(400);
    expect(llamadas).toHaveLength(0);                     // ni siquiera llega a la BD
  });

  it('bbox se envía como parámetros', async () => {
    await request(app.getHttpServer()).get('/colonias?bbox=-98.3,19,-98.1,19.1').expect(200);
    expect(llamadas[0].params.slice(0, 4)).toEqual([-98.3, 19, -98.1, 19.1]);
  });

  it('GET /colonias/geojson devuelve una FeatureCollection', async () => {
    respuesta = [{ id: 'a', nombre: 'Z', num_comercios: 1, geometry: { type: 'MultiPolygon', coordinates: [] } }];
    const r = await request(app.getHttpServer()).get('/colonias/geojson').expect(200);
    expect(r.body.type).toBe('FeatureCollection');
    expect(r.body.features[0]).toMatchObject({ type: 'Feature', id: 'a', geometry: { type: 'MultiPolygon' } });
    expect(r.body.features[0].properties.geometry).toBeUndefined();
  });

  it('GET /colonias/:id → 404 si no existe', async () => {
    await request(app.getHttpServer()).get('/colonias/5b0fd1a2-0000-4000-8000-000000000000').expect(404);
  });

  it('tile MVT: content-type protobuf y cache', async () => {
    respuesta = [{ mvt: Buffer.from([1, 2, 3]) }];
    const r = await request(app.getHttpServer()).get('/tiles/colonias/14/3700/7000.mvt').expect(200);
    expect(r.headers['content-type']).toContain('application/x-protobuf');
    expect(r.headers['cache-control']).toContain('max-age');
  });

  it('GET /datos-abiertos/validacion → 404 sin corridas y 200 con resultado', async () => {
    await request(app.getHttpServer()).get('/datos-abiertos/validacion').expect(404);
    respuesta = [{ id: 1, aprobada: true, modo: 'fixture', resultados: [] }];
    await request(app.getHttpServer()).get('/datos-abiertos/validacion').expect(200);
  });

  it('incluye cabeceras de seguridad de helmet', async () => {
    respuesta = [{ postgis: '3.4' }];
    const r = await request(app.getHttpServer()).get('/health');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
});
