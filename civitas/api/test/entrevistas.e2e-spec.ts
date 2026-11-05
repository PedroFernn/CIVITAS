import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';

const TOKEN = 'a'.repeat(43);
const ID = '55555555-5555-4555-8555-555555555555';
const ZONA = '11111111-1111-4111-8111-111111111111';

/** MVP-5 · entrevistas de precio con BD simulada: solo administradores, validación y que no se guarden datos personales. */
describe('API MVP-5 · entrevistas (BD simulada)', () => {
  let app: INestApplication;
  let rol: 'administrador' | 'usuario' = 'administrador';
  const llamadas: { sql: string; params: unknown[] }[] = [];
  let respuesta: any[] = [];
  let falla: any = null;
  const fakeDb = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (/FROM sesiones/.test(sql)) return [{ id: 'u1', usuario: 'ana', rol, correo: null, proposito: null, es_demo: false, creado_en: '', ultimo_acceso: null }];
      llamadas.push({ sql, params });
      if (falla) throw falla;
      return respuesta;
    }),
    onModuleDestroy: jest.fn(),
  };
  const http = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${TOKEN}`);

  beforeAll(async () => {
    process.env.DEMO_USERS = '0';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(fakeDb).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  });
  afterAll(async () => { delete process.env.DEMO_USERS; await app.close(); });
  beforeEach(() => { llamadas.length = 0; respuesta = []; falla = null; rol = 'administrador'; });

  const valida = {
    tipo: 'inquilino', alias: 'Inquilina 1', realizada_en: '2026-11-03', modalidad: 'remota', duracion_min: 15, zona_id: ZONA,
    renta_actual_mxn: 8500, renta_justa_mxn: 7500, acepta_pagar: null,
    notas: 'Paga $8,500 por un depa de 2 recámaras y le parece caro por la distancia al metro.',
  };

  it.each([['get', '/entrevistas'], ['get', '/entrevistas/validacion'], ['post', '/entrevistas'], ['put', `/entrevistas/${ID}`], ['delete', `/entrevistas/${ID}`]])(
    '%s %s sin sesión → 401 sin tocar la BD', async (m, url) => {
      await (http() as any)[m](url).expect(401);
      expect(llamadas).toHaveLength(0);
    });

  it('un usuario sin rol de administrador → 403', async () => {
    rol = 'usuario';
    await auth(http().get('/entrevistas')).expect(403);
    await auth(http().post('/entrevistas').send(valida)).expect(403);
    expect(llamadas).toHaveLength(0);
  });

  it('GET /entrevistas lista y resume el avance (3 inquilinos + 2 B2B con notas)', async () => {
    const f = (tipo: string, acepta: boolean | null) => ({ id: tipo + Math.random(), tipo, alias: 'x', notas: 'notas con más de veinte caracteres', acepta_pagar: acepta });
    respuesta = [f('inquilino', null), f('inquilino', null), f('b2b', true)];
    const r = await auth(http().get('/entrevistas')).expect(200);
    expect(r.body.resumen).toMatchObject({ total: 3, completas: false, b2b_aceptarian_pagar: 1,
      por_tipo: { inquilino: { hechas: 2, objetivo: 3 }, b2b: { hechas: 1, objetivo: 2 } } });
    expect(r.body.resumen.faltan).toEqual(['1 inquilino(s) o estudiante(s)', '1 inmobiliaria(s) o administradora(s)']);
  });

  it('POST guarda con parámetros y registra quién la capturó', async () => {
    respuesta = [{ id: ID }];
    const r = await auth(http().post('/entrevistas').send(valida)).expect(201);
    expect(r.body).toEqual({ id: ID });
    expect(llamadas[0].params).toEqual(['inquilino', 'Inquilina 1', '2026-11-03', 'remota', 15, ZONA, 8500, 7500, null, null, valida.notas, 'ana']);
    expect(llamadas[0].sql).not.toContain('Inquilina 1');
  });

  it.each([
    ['tipo desconocido', { tipo: 'vecino' }],
    ['sin alias', { alias: '' }],
    ['alias con correo', { alias: 'ana@correo.mx' }],
    ['alias con teléfono', { alias: 'Ana 222 123 4567' }],
    ['notas muy cortas', { notas: 'caro' }],
    ['notas con correo', { notas: 'Dijo que le escriban a juan@correo.mx para ver el precio de su zona.' }],
    ['notas con teléfono', { notas: 'Su número es 2221234567 y comentó que paga de más por su departamento.' }],
    ['fecha futura', { realizada_en: '2999-01-01' }],
    ['fecha imposible', { realizada_en: '2026-02-31' }],
    ['modalidad inválida', { modalidad: 'telepática' }],
    ['zona_id que no es UUID', { zona_id: '1; DROP TABLE colonias' }],
    ['renta absurda', { renta_justa_mxn: 5 }],
    ['monto sin aceptar pagar', { acepta_pagar: false, monto_dispuesto_mxn: 99 }],
    ['acepta_pagar no booleano', { acepta_pagar: 'sí' }],
  ])('POST con %s → 400 sin tocar la BD', async (_n, cambio) => {
    await auth(http().post('/entrevistas').send({ ...valida, ...cambio })).expect(400);
    expect(llamadas).toHaveLength(0);
  });

  it('un monto de dinero en las notas no se confunde con un teléfono', async () => {
    respuesta = [{ id: ID }];
    await auth(http().post('/entrevistas').send({ ...valida, notas: 'Paga 8500 de renta, cree justo 7500 y pagaría 99 pesos; compara con 12000 en el centro.' })).expect(201);
  });

  it('POST con una zona inexistente (violación de llave foránea) → 400', async () => {
    falla = { code: '23503' };
    const r = await auth(http().post('/entrevistas').send(valida)).expect(400);
    expect(r.body.message).toContain('zona_id');
  });

  it('PUT corrige y PUT sobre una entrevista que no existe → 404', async () => {
    respuesta = [{ id: ID }];
    await auth(http().put(`/entrevistas/${ID}`).send({ ...valida, acepta_pagar: true, monto_dispuesto_mxn: 99 })).expect(200);
    expect(llamadas[0].params[0]).toBe(ID);
    respuesta = [];
    await auth(http().put(`/entrevistas/${ID}`).send(valida)).expect(404);
    await auth(http().put('/entrevistas/no-es-uuid').send(valida)).expect(400);
  });

  it('DELETE → 204, y 404 si no existe', async () => {
    respuesta = [{ id: ID }];
    await auth(http().delete(`/entrevistas/${ID}`)).expect(204);
    respuesta = [];
    await auth(http().delete(`/entrevistas/${ID}`)).expect(404);
  });

  it('GET /entrevistas/validacion → 404 si no se ha corrido el checklist, y el último resultado si existe', async () => {
    await auth(http().get('/entrevistas/validacion')).expect(404);
    respuesta = [{ id: 1, aprobada: false, modo: 'fixture', resultados: [] }];
    const r = await auth(http().get('/entrevistas/validacion')).expect(200);
    expect(r.body.aprobada).toBe(false);
    expect(llamadas.at(-1)!.sql).toContain('mvp5_validaciones');
  });
});
