import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';

const [A, B, C] = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];

/** MVP-5 · comparador de hasta 3 zonas y filtro de transporte, con BD simulada: contrato HTTP, validación y parametrización. */
describe('API MVP-5 · comparador y transporte (BD simulada)', () => {
  let app: INestApplication;
  const llamadas: { sql: string; params: unknown[] }[] = [];
  let respuestas: any[][] = [];                      // una por consulta, en orden
  const fakeDb = { query: jest.fn(async (sql: string, params: unknown[] = []) => { llamadas.push({ sql, params }); return respuestas.shift() ?? []; }), onModuleDestroy: jest.fn() };

  beforeAll(async () => {
    process.env.DEMO_USERS = '0';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(fakeDb).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  });
  afterAll(async () => { delete process.env.DEMO_USERS; await app.close(); });
  beforeEach(() => { llamadas.length = 0; respuestas = []; });

  const zona = (id: string, nombre: string, extra: object = {}) => ({
    id, nombre, ciudad: 'Puebla', clave_geo: '2111400', tipo_unidad: 'ageb', es_piloto: true, area_km2: 2, num_comercios: 100, num_paradas: 8,
    n_listados: 12, n_precio_m2: 12, estadistica_suprimida: false, renta_mediana: 12000, renta_p25: 10000, renta_p75: 14000, precio_m2_mediano: 200,
    geometry: { type: 'Polygon', coordinates: [] }, lugar: 2, de: 20, ...extra,
  });
  const ciudad = { ciudad: 'Puebla', n_listados: 400, zonas: 30, renta_mediana: 10000, precio_m2_mediano: 180 };

  it('compara 3 zonas en el orden pedido, aunque la BD las devuelva en otro', async () => {
    respuestas = [[zona(C, 'C'), zona(A, 'A'), zona(B, 'B')], [ciudad]];
    const r = await request(app.getHttpServer()).get(`/zonas/comparar?items=${A},${B},${C}`).expect(200);
    expect(r.body.items.map((z: any) => z.nombre)).toEqual(['A', 'B', 'C']);
    expect(r.body).toMatchObject({ max: 3, min_listados_estadistica: 5 });
    expect(r.body.items[0]).toMatchObject({ posicion_precio_m2: { lugar: 2, de: 20 }, renta_vs_ciudad_pct: 20, paradas_por_km2: 4 });
    expect(r.body.items[0].lugar).toBeUndefined();
    expect(llamadas[0].params).toEqual([[A, B, C]]);                               // los ids viajan como parámetro
    expect(llamadas[0].sql).toContain('ANY($1::uuid[])');
    expect(llamadas[0].sql).not.toContain(A);
    expect(llamadas[1].params).toEqual([['Puebla']]);
  });

  it('la ruta fija «comparar» no se confunde con /zonas/:id', async () => {
    respuestas = [[zona(A, 'A')], [ciudad]];
    await request(app.getHttpServer()).get(`/zonas/comparar?items=${A}`).expect(200);
  });

  it('una zona con estadística suprimida aparece sin cifras de precio ni diferencia contra la ciudad', async () => {
    respuestas = [[zona(A, 'A', { estadistica_suprimida: true, n_listados: 2, renta_mediana: null, renta_p25: null, renta_p75: null, precio_m2_mediano: null, lugar: null, de: null })], [ciudad]];
    const r = await request(app.getHttpServer()).get(`/zonas/comparar?items=${A}`).expect(200);
    expect(r.body.items[0]).toMatchObject({ renta_mediana: null, posicion_precio_m2: null, renta_vs_ciudad_pct: null });
  });

  it('los ids repetidos cuentan una sola vez', async () => {
    respuestas = [[zona(A, 'A')], [ciudad]];
    await request(app.getHttpServer()).get(`/zonas/comparar?items=${A},${A.toUpperCase()},${A}`).expect(200);
    expect(llamadas[0].params).toEqual([[A]]);
  });

  it('un id que no existe → 404', async () => {
    respuestas = [[zona(A, 'A'), zona(B, 'B')]];
    const r = await request(app.getHttpServer()).get(`/zonas/comparar?items=${A},${B},${C}`).expect(404);
    expect(r.body.message).toContain(C);
  });

  it.each([
    ['más de 3 zonas', `?items=${A},${B},${C},44444444-4444-4444-8444-444444444444`],
    ['sin items', ''], ['items vacío', '?items='], ['un id que no es UUID', `?items=${A},no-es-uuid`],
    ['inyección SQL', `?items=${encodeURIComponent(`${A}'; DROP TABLE colonias;--`)}`], ['demasiado largo', `?items=${'a,'.repeat(150)}`],
  ])('%s → 400 sin tocar la BD', async (_n, qs) => {
    await request(app.getHttpServer()).get(`/zonas/comparar${qs}`).expect(400);
    expect(llamadas).toHaveLength(0);
  });

  it('min_paradas filtra por transporte con un parámetro y sin interpolar', async () => {
    respuestas = [[{ id: A, nombre: 'A', total: 1 }]];
    await request(app.getHttpServer()).get('/zonas?min_paradas=5&min_renta=8000').expect(200);
    expect(llamadas[0].params).toEqual([8000, 5, 12, 0]);
    expect(llamadas[0].sql).toContain('COALESCE(a.num_paradas,0) >= $2');
  });

  it('min_paradas aplica también al mapa y a la búsqueda por texto', async () => {
    await request(app.getHttpServer()).get('/zonas/geojson?min_paradas=3').expect(200);
    expect(llamadas[0].params).toEqual([3, 500]);
    await request(app.getHttpServer()).get('/zonas?q=centro&min_paradas=2').expect(200);
    expect(llamadas.at(-1)!.params).toEqual([['%centro%'], 2]);                    // orden=relevancia: sin limit/offset en SQL
  });

  it.each([['-1'], ['abc'], ['1.5'], ['100001']])('min_paradas=%s → 400', async (v) => {
    await request(app.getHttpServer()).get(`/zonas?min_paradas=${v}`).expect(400);
    expect(llamadas).toHaveLength(0);
  });
});
