import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';

/** Autenticación con BD simulada: lo que se decide antes de tocar la base de datos. */
describe('API auth (BD simulada)', () => {
  let app: INestApplication;
  const llamadas: string[] = [];
  const fakeDb = { query: jest.fn(async (sql: string) => { llamadas.push(sql); return []; }), onModuleDestroy: jest.fn() };

  beforeAll(async () => {
    process.env.DEMO_USERS = '0';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(fakeDb).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  });
  afterAll(async () => { delete process.env.DEMO_USERS; await app.close(); });
  beforeEach(() => { llamadas.length = 0; });

  it('con DEMO_USERS=0 no se siembra nada, se limpian las cuentas de ejemplo y /auth/estado lo dice', async () => {
    const r = await request(app.getHttpServer()).get('/auth/estado').expect(200);
    expect(r.body).toEqual({ demo: false });
    expect(llamadas.some((q) => /INSERT/i.test(q))).toBe(false);                 // nunca siembra con el modo demo apagado
    expect(llamadas).toEqual(['DELETE FROM usuarios WHERE es_demo RETURNING usuario']);   // y limpia lo que hubiera
  });

  it.each([
    ['/auth/registro', { usuario: 'x' }], ['/auth/registro', { usuario: 'ana', correo: 'a@b.mx', contrasena: 'clave-larga', acepta_aviso: false }],
    ['/auth/login', {}], ['/auth/login', { identificador: 'a' }],
  ])('%s con datos inválidos → 400 sin tocar la BD', async (url, cuerpo) => {
    await request(app.getHttpServer()).post(url).send(cuerpo).expect(400);
    expect(llamadas).toHaveLength(0);
  });

  it.each([['get', '/auth/me'], ['post', '/auth/logout'], ['get', '/admin/resumen']])('%s %s sin token → 401 sin tocar la BD', async (m, url) => {
    await (request(app.getHttpServer()) as any)[m](url).expect(401);
    expect(llamadas).toHaveLength(0);
  });

  it('un token con formato inválido → 401 sin consultar la BD', async () => {
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer corto').expect(401);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Basic abc').expect(401);
    expect(llamadas).toHaveLength(0);
  });

  it('un token bien formado pero desconocido → 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${'a'.repeat(43)}`).expect(401);
    expect(llamadas).toHaveLength(1);
  });
});
