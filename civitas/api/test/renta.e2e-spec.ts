import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';

/** MVP-3 con BD simulada: contrato HTTP, validación de entrada y SQL siempre parametrizado. */
describe('API MVP-3 · listados de renta (BD simulada)', () => {
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

  it('GET /listados-renta devuelve items, total paginado y filtros parametrizados', async () => {
    respuesta = [{ id: '1', precio_mxn: 9000, superficie_m2: 60, recamaras: 2, lat: 19.04, lon: -98.2, zona_id: 'z', total: 372 }];
    const zona = '5b0fd1a2-0000-4000-8000-000000000000';
    const r = await request(app.getHttpServer())
      .get(`/listados-renta?zona_id=${zona}&tipo=departamento&recamaras=2&min_precio=5000&max_precio=15000&orden=precio&limit=10`).expect(200);
    expect(r.body.total).toBe(372);
    expect(r.body.items[0].total).toBeUndefined();
    const { sql, params } = llamadas[0];
    expect(params).toEqual([zona, 'departamento', 2, 5000, 15000, 10, 0]);
    expect(sql).not.toContain('departamento');          // nada interpolado en el SQL
    expect(sql).toContain('ORDER BY l.precio_mxn DESC');
  });

  it('con_zona=false filtra los que no tienen zona, sin parámetros extra', async () => {
    await request(app.getHttpServer()).get('/listados-renta?con_zona=false').expect(200);
    expect(llamadas[0].sql).toContain('l.zona_id IS NULL');
    expect(llamadas[0].params).toEqual([50, 0]);
  });

  it('la consulta no expone columnas de contacto', async () => {
    await request(app.getHttpServer()).get('/listados-renta').expect(200);
    expect(llamadas[0].sql).not.toMatch(/telefono|anunciante|contacto|descripcion/i);
  });

  it.each([
    ['/listados-renta?limit=1000'], ['/listados-renta?limit=abc'], ['/listados-renta?orden=precio;DROP TABLE listados_renta'],
    ['/listados-renta?zona_id=no-es-uuid'], ['/listados-renta?tipo=castillo'], ['/listados-renta?recamaras=99'],
    ['/listados-renta?min_precio=-1'], ['/listados-renta?min_precio=9000&max_precio=100'], ['/listados-renta?con_zona=quizas'],
    ['/listados-renta/resumen-zonas?limit=0'],
  ])('rechaza entrada inválida: %s → 400', async (url) => {
    await request(app.getHttpServer()).get(url).expect(400);
    expect(llamadas).toHaveLength(0);
  });

  it('resumen-zonas pasa el mínimo de listados como parámetro y publica el umbral', async () => {
    respuesta = [{ zona_id: 'z', n_listados: 3, estadistica_suprimida: true, renta_mediana: null, total: 1 }];
    const r = await request(app.getHttpServer()).get('/listados-renta/resumen-zonas?limit=20').expect(200);
    expect(r.body.min_listados_estadistica).toBe(5);
    expect(r.body.items[0]).toMatchObject({ estadistica_suprimida: true, renta_mediana: null });
    expect(llamadas[0].params).toEqual([5, 20]);
  });

  it('calidad y validacion: 404 sin datos, 200 con datos', async () => {
    await request(app.getHttpServer()).get('/listados-renta/calidad').expect(404);
    await request(app.getHttpServer()).get('/listados-renta/validacion').expect(404);
    respuesta = [{ resumen: { carga_id: 4, campos_clave: { tasa_nulos: 0.06 } } }];
    const c = await request(app.getHttpServer()).get('/listados-renta/calidad').expect(200);
    expect(c.body.campos_clave.tasa_nulos).toBe(0.06);
    respuesta = [{ id: 1, aprobada: true, modo: 'fixture', resultados: [] }];
    await request(app.getHttpServer()).get('/listados-renta/validacion').expect(200);
  });
});
