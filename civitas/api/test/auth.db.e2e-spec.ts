import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Config, nuevaConfig } from '../src/etl/config';
import { conectar, Conn } from '../src/etl/db';
import { correrMvp2 } from '../src/etl/pipeline';
import { prepararBdPruebas, TEST_DB_URL } from './helpers/db';

/** Cuentas, roles y sesiones sobre PostgreSQL real (con las cuentas de demostración sembradas). */
describe('API auth (PostgreSQL real)', () => {
  let app: INestApplication | undefined;
  let conn: Conn;
  let listo = false;
  const http = () => request(app!.getHttpServer());
  const login = (identificador: string, contrasena: string, extra: object = {}) => http().post('/auth/login').send({ identificador, contrasena, ...extra });
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const registro = { usuario: 'maria', correo: 'maria@ejemplo.mx', contrasena: 'clave-segura-1', proposito: 'rentar', acepta_aviso: true };

  beforeAll(async () => {
    listo = await prepararBdPruebas();
    if (!listo) return;
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.DEMO_USERS = '1';
    const cfg: Config = nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest' });
    expect(await correrMvp2(cfg, true, true)).toBe(true); // esquema desde cero (incluye la migración 004)
    conn = await conectar(TEST_DB_URL);
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
  }, 180_000);
  afterAll(async () => { delete process.env.DEMO_USERS; await app?.close(); await conn?.close(); });

  const si = (n: string, fn: () => Promise<void>) => it(n, async () => { if (listo) await fn(); });

  si('las dos cuentas de ejemplo existen: usr1 (usuario) y adm (administrador)', async () => {
    const r = await conn.query('SELECT usuario, rol, es_demo, correo FROM usuarios ORDER BY usuario');
    expect(r).toEqual([{ usuario: 'adm', rol: 'administrador', es_demo: true, correo: null }, { usuario: 'usr1', rol: 'usuario', es_demo: true, correo: null }]);
    expect((await http().get('/auth/estado').expect(200)).body).toEqual({ demo: true });
  });

  si('las contraseñas se guardan solo como hash scrypt', async () => {
    const r = await conn.query('SELECT password_hash FROM usuarios');
    for (const { password_hash } of r) { expect(password_hash).toMatch(/^scrypt\$/); expect(password_hash).not.toMatch(/\$(123|456)$/); }
    expect(JSON.stringify(r)).not.toMatch(/"(123|456)"/);
  });

  si('usr1 / 123 entra como usuario; adm / 456 entra como administrador', async () => {
    const u = await login('usr1', '123').expect(200);
    expect(u.body.usuario).toEqual({ usuario: 'usr1', rol: 'usuario' });
    expect(u.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const a = await login('adm', '456').expect(200);
    expect(a.body.usuario).toEqual({ usuario: 'adm', rol: 'administrador' });
    const me = await http().get('/auth/me').set(bearer(a.body.token)).expect(200);
    expect(me.body).toMatchObject({ usuario: 'adm', rol: 'administrador', es_demo: true });
    expect(JSON.stringify(me.body)).not.toMatch(/password|hash/i);
  });

  si('el usuario no distingue mayúsculas; la contraseña sí', async () => {
    await login('  USR1 ', '123').expect(200);
    await login('usr1', '1234').expect(401);
  });

  si('error genérico: mismo mensaje para usuario inexistente y contraseña errónea', async () => {
    const a = await login('no-existe', 'x').expect(401);
    const b = await login('usr1', 'x').expect(401);
    expect(a.body.message).toBe(b.body.message);
    expect(a.body.message).toBe('Usuario o contraseña incorrectos');
  });

  si('control por rol: administrador → 200, usuario → 403, sin sesión → 401', async () => {
    const u = (await login('usr1', '123')).body.token, a = (await login('adm', '456')).body.token;
    const r = await http().get('/admin/resumen').set(bearer(a)).expect(200);
    expect(r.body).toMatchObject({ cuentas_demo: 2, administradores: 1 });
    expect(r.body.usuarios.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(r.body)).not.toMatch(/password|hash|correo/i);   // el panel no expone contraseñas ni correos
    await http().get('/admin/resumen').set(bearer(u)).expect(403);
    await http().get('/admin/resumen').expect(401);
  });

  si('registro: crea cuenta con rol usuario, abre sesión y guarda el consentimiento', async () => {
    const r = await http().post('/auth/registro').send(registro).expect(201);
    expect(r.body.usuario).toEqual({ usuario: 'maria', rol: 'usuario' });
    await http().get('/auth/me').set(bearer(r.body.token)).expect(200);
    const fila = await conn.one("SELECT correo, rol, proposito, es_demo, consentimiento_aviso_en FROM usuarios WHERE usuario='maria'");
    expect(fila).toMatchObject({ correo: 'maria@ejemplo.mx', rol: 'usuario', proposito: 'rentar', es_demo: false });
    expect(fila.consentimiento_aviso_en).toBeInstanceOf(Date);
    await login('maria@ejemplo.mx', 'clave-segura-1').expect(200);       // también entra con el correo
  });

  si('no se puede crear un administrador desde el registro (escalada de privilegios)', async () => {
    const r = await http().post('/auth/registro').send({ ...registro, usuario: 'intruso', correo: 'i@ejemplo.mx', rol: 'administrador', es_demo: true }).expect(201);
    expect(r.body.usuario.rol).toBe('usuario');
    await http().get('/admin/resumen').set(bearer(r.body.token)).expect(403);
    expect((await conn.one("SELECT rol, es_demo FROM usuarios WHERE usuario='intruso'"))).toEqual({ rol: 'usuario', es_demo: false });
  });

  si('registro rechaza duplicados (sin distinguir mayúsculas), contraseña débil y falta de consentimiento', async () => {
    await http().post('/auth/registro').send({ ...registro, usuario: 'MARIA', correo: 'otra@ejemplo.mx' }).expect(409);
    await http().post('/auth/registro').send({ ...registro, usuario: 'maria2', correo: 'MARIA@ejemplo.mx' }).expect(409);
    await http().post('/auth/registro').send({ ...registro, usuario: 'usr1', correo: 'z@ejemplo.mx' }).expect(409);   // no se pisa una cuenta de ejemplo
    await http().post('/auth/registro').send({ ...registro, usuario: 'debil', correo: 'd@ejemplo.mx', contrasena: '123' }).expect(400);
    await http().post('/auth/registro').send({ ...registro, usuario: 'sinaviso', correo: 's@ejemplo.mx', acepta_aviso: false }).expect(400);
    expect(await conn.query("SELECT 1 FROM usuarios WHERE usuario IN ('debil','sinaviso','maria2')")).toHaveLength(0);
  });

  si('cerrar sesión invalida el token', async () => {
    const t = (await login('usr1', '123')).body.token;
    await http().get('/auth/me').set(bearer(t)).expect(200);
    await http().post('/auth/logout').set(bearer(t)).expect(200);
    await http().get('/auth/me').set(bearer(t)).expect(401);
  });

  si('las sesiones expiran y el token no se guarda en claro', async () => {
    const t = (await login('usr1', '123')).body.token;
    expect(JSON.stringify(await conn.query('SELECT * FROM sesiones'))).not.toContain(t);
    await conn.query("UPDATE sesiones SET expira_en = now() - interval '1 minute'");
    await http().get('/auth/me').set(bearer(t)).expect(401);
  });

  si('"recordar" alarga la sesión (30 días) frente a la sesión normal (12 h)', async () => {
    const horas = (iso: string) => (Date.parse(iso) - Date.now()) / 3600_000;
    expect(horas((await login('usr1', '123')).body.expira_en)).toBeLessThan(12.1);
    expect(horas((await login('usr1', '123', { recordar: true })).body.expira_en)).toBeGreaterThan(24 * 29);
  });

  si('tras 5 intentos fallidos la cuenta se bloquea temporalmente (429), aun con la contraseña correcta', async () => {
    await http().post('/auth/registro').send({ ...registro, usuario: 'bloqueable', correo: 'b@ejemplo.mx' }).expect(201);
    for (let i = 0; i < 5; i++) await login('bloqueable', 'mala').expect(401);
    const r = await login('bloqueable', 'clave-segura-1').expect(429);
    expect(r.body.reintentar_en_s).toBeGreaterThan(0);
    await login('usr1', '123').expect(200);                                // otras cuentas no se ven afectadas
  });

  si('sembrar es idempotente y no pisa una contraseña cambiada', async () => {
    await conn.query("UPDATE usuarios SET password_hash = (SELECT password_hash FROM usuarios WHERE usuario='maria') WHERE usuario='usr1'");
    const { AuthService } = await import('../src/auth/auth.service');
    const svc = app!.get(AuthService);
    (svc as any).demoListo = false;
    await svc.sembrarDemo();
    expect(Number((await conn.one("SELECT count(*) AS n FROM usuarios WHERE es_demo")).n)).toBe(2);
    await login('usr1', '123').expect(401);                                // no se restableció a "123"
    await login('usr1', 'clave-segura-1').expect(200);
  });

  si('DEMO_USERS=0 ELIMINA las cuentas de ejemplo ya sembradas (y sus sesiones); encenderlo de nuevo las recrea con los valores de origen', async () => {
    const { AuthService } = await import('../src/auth/auth.service');
    const svc = app!.get(AuthService);
    const token = (await login('adm', '456')).body.token;
    await http().get('/admin/resumen').set(bearer(token)).expect(200);

    process.env.DEMO_USERS = '0';
    await svc.sincronizarDemo();
    expect(await conn.query('SELECT 1 FROM usuarios WHERE es_demo')).toHaveLength(0);
    await login('adm', '456').expect(401);
    await http().get('/admin/resumen').set(bearer(token)).expect(401);                  // la sesión de la cuenta eliminada también cae
    expect((await http().get('/auth/estado').expect(200)).body).toEqual({ demo: false });
    expect(await conn.query("SELECT 1 FROM usuarios WHERE usuario IN ('maria','intruso')")).toHaveLength(2);   // las cuentas reales no se tocan

    process.env.DEMO_USERS = '1';
    await svc.sincronizarDemo();
    await login('adm', '456').expect(200);                                              // vuelve con la contraseña de origen
  });

  si('las rutas públicas siguen siendo públicas', async () => {
    await http().get('/health').expect(200);
    await http().get('/colonias?limit=1').expect(200);
  });
});
