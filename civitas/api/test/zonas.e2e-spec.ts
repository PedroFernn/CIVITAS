import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';

/** Pruebas e2e de /zonas con BD simulada: contrato HTTP, validación de entrada y parametrización. */
describe('API MVP-4 · zonas (BD simulada)', () => {
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

  const zona = (nombre: string, extra: object = {}) => ({ id: nombre, nombre, clave_geo: null, ciudad: 'Puebla', n_listados: 0, ...extra });

  it('GET /zonas/buscar ordena por relevancia, recorta al límite y no interpola nada en el SQL', async () => {
    respuesta = [zona('AGEB sintético 14'), zona('AGEB sintético 04'), zona('AGEB sintético 40')];
    const r = await request(app.getHttpServer()).get('/zonas/buscar?q=4&limit=2').expect(200);
    expect(r.body.items.map((z: any) => z.nombre)).toEqual(['AGEB sintético 04', 'AGEB sintético 40'])   // «4»: «04» exacto; «40» empieza con 4; «14» solo lo contiene;
    expect(r.body).toMatchObject({ q: '4', sugeridas: false, total: 3 });
    expect(llamadas[0].params).toEqual([['%4%']]);
    expect(llamadas[0].sql).not.toContain('%4%');
  });

  it('buscar sin texto devuelve sugeridas (las de más listados)', async () => {
    respuesta = [zona('A')];
    const r = await request(app.getHttpServer()).get('/zonas/buscar').expect(200);
    expect(r.body.sugeridas).toBe(true);
    expect(llamadas[0].sql).toContain('v.n_listados,0) DESC');
  });

  it('los comodines de LIKE se escapan', async () => {
    await request(app.getHttpServer()).get('/zonas/buscar?q=50%25_').expect(200);
    expect(llamadas[0].params).toEqual([['%50\\%\\_%']]);
  });

  it('GET /zonas pagina, suprime estadísticas y devuelve el total', async () => {
    respuesta = [{ ...zona('A'), total: 30, estadistica_suprimida: true, renta_mediana: null }];
    const r = await request(app.getHttpServer()).get('/zonas?orden=renta&limit=10&offset=20&min_renta=5000').expect(200);
    expect(r.body).toMatchObject({ total: 30, limit: 10, offset: 20, min_listados_estadistica: 5 });
    expect(r.body.items[0].total).toBeUndefined();
    expect(llamadas[0].params).toEqual([5000, 10, 20]);
    expect(llamadas[0].sql).toContain('COALESCE(v.n_listados,0) >= 5');
  });

  it('GET /zonas/geojson devuelve un FeatureCollection', async () => {
    respuesta = [{ ...zona('A'), geometry: { type: 'Polygon', coordinates: [] } }];
    const r = await request(app.getHttpServer()).get('/zonas/geojson').expect(200);
    expect(r.body.type).toBe('FeatureCollection');
    expect(r.body.features[0]).toMatchObject({ type: 'Feature', id: 'A', properties: { nombre: 'A' } });
    expect(r.body.features[0].properties.geometry).toBeUndefined();
  });

  it('las rutas fijas no se confunden con un UUID y un :id inválido es 400', async () => {
    await request(app.getHttpServer()).get('/zonas/buscar').expect(200);
    await request(app.getHttpServer()).get('/zonas/validacion').expect(404);   // sin validaciones: 404, no 400
    await request(app.getHttpServer()).get('/zonas/no-es-uuid').expect(400);
  });

  it('detalle de una zona inexistente es 404', async () => {
    await request(app.getHttpServer()).get('/zonas/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it.each([
    ['/zonas?orden=relevancia'], ['/zonas?orden=x'], ['/zonas?limit=500'], ['/zonas?min_renta=9&max_renta=1'], ['/zonas?piloto=maybe'],
    ['/zonas/buscar?limit=50'], ['/zonas/buscar?q=' + 'a'.repeat(200)],
  ])('rechaza entrada inválida: %s → 400', async (url) => {
    await request(app.getHttpServer()).get(url).expect(400);
    expect(llamadas).toHaveLength(0);
  });
});
