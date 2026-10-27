import {
  HttpException, HttpStatus, Injectable, Logger, OnModuleInit, ServiceUnavailableException, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { hashContrasena, hashDeRelleno, verificarContrasena } from './contrasenas';
import { demoHabilitado } from './demo';
import { LimitadorIntentos } from './limitador';
import { DatosLogin, DatosRegistro, Rol } from './validacion-auth';

export interface UsuarioSesion {
  id: string; usuario: string; rol: Rol; correo: string | null; proposito: string | null;
  es_demo: boolean; creado_en: string; ultimo_acceso: string | null;
}
export interface SesionAbierta { token: string; expira_en: string; usuario: { usuario: string; rol: Rol } }

/**
 * Cuentas de ejemplo (ver demoHabilitado: por defecto solo en local; DEMO_USERS=1/0 fuerza). Contraseñas triviales A PROPÓSITO para demostraciones:
 * nunca deben existir en un servidor público (DEMO_USERS=0 y, si ya se sembraron, borrarlas: ver docs/auth/AUTH.md).
 */
export const CUENTAS_DEMO: ReadonlyArray<{ usuario: string; contrasena: string; rol: Rol }> = [
  { usuario: 'usr1', contrasena: '123', rol: 'usuario' },
  { usuario: 'adm', contrasena: '456', rol: 'administrador' },
];

const TTL_SESION_MS = 12 * 3600_000;
const TTL_RECORDAR_MS = 30 * 24 * 3600_000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger('Auth');
  private demoListo = false;
  readonly limitador = new LimitadorIntentos();

  constructor(private readonly db: DatabaseService) {}

  get demoActivo(): boolean {
    return demoHabilitado();
  }

  async onModuleInit() {
    await this.sincronizarDemo();
  }

  /**
   * Las cuentas de ejemplo existen SOLO mientras el modo demo está activo: encendido las crea; apagado las elimina
   * (con sus sesiones). Así `DEMO_USERS=0` basta para dejar un servidor sin contraseñas triviales, aunque antes se hubieran sembrado.
   */
  async sincronizarDemo(): Promise<void> {
    if (this.demoActivo) return this.sembrarDemo();
    this.demoListo = false;
    try {
      const r = await this.db.query('DELETE FROM usuarios WHERE es_demo RETURNING usuario');
      if (r.length) this.log.warn(`Modo demo apagado: se eliminaron las cuentas de demostración (${r.map((x: any) => x.usuario).join(', ')}).`);
    } catch (e) {
      if ((e as any)?.code !== '42P01') this.log.error(`No se pudieron limpiar las cuentas de demostración: ${(e as Error).message}`);
    }
  }

  /** Idempotente y tolerante: si las migraciones aún no corrieron, se reintenta en la siguiente petición de acceso. */
  async sembrarDemo(): Promise<void> {
    if (!this.demoActivo || this.demoListo) return;
    try {
      for (const c of CUENTAS_DEMO) {
        await this.db.query(
          'INSERT INTO usuarios (usuario, password_hash, rol, es_demo) VALUES ($1, $2, $3, true) ON CONFLICT (usuario) DO NOTHING',
          [c.usuario, await hashContrasena(c.contrasena), c.rol]);
      }
      this.demoListo = true;
      this.log.warn(`CUENTAS DE DEMOSTRACIÓN ACTIVAS (${CUENTAS_DEMO.map((c) => c.usuario).join(', ')}). Pon DEMO_USERS=0 en cualquier servidor público.`);
    } catch (e) {
      if ((e as any)?.code === '42P01') this.log.warn('Cuentas de demostración pendientes: aún no hay migraciones (servicio migrate / etl migrar).');
      else this.log.error(`No se pudieron sembrar las cuentas de demostración: ${(e as Error).message}`);
    }
  }

  /** Consulta con error claro si faltan las migraciones de cuentas. */
  private async q<T extends Record<string, any> = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      return await this.db.query<T>(sql, params);
    } catch (e) {
      if ((e as any)?.code === '42P01') {
        throw new ServiceUnavailableException('Faltan las migraciones de cuentas: corre el servicio `migrate` o `etl migrar`.');
      }
      throw e;
    }
  }

  async registrar(d: DatosRegistro): Promise<SesionAbierta> {
    const hash = await hashContrasena(d.contrasena);
    try {
      // El rol NO viene del cliente: toda cuenta nueva es 'usuario'.
      const [u] = await this.q(
        `INSERT INTO usuarios (usuario, correo, password_hash, rol, proposito, consentimiento_aviso_en)
         VALUES ($1, $2, $3, 'usuario', $4, now()) RETURNING id, usuario, rol`,
        [d.usuario, d.correo, hash, d.proposito]);
      return this.abrirSesion(u, false);
    } catch (e) {
      if ((e as any)?.code === '23505') {
        const campo = String((e as any).constraint ?? '').includes('correo') ? 'correo' : 'usuario';
        throw new ConflictException(campo === 'correo' ? 'Ese correo ya tiene una cuenta' : 'Ese nombre de usuario ya está en uso');
      }
      throw e;
    }
  }

  async iniciarSesion(d: DatosLogin): Promise<SesionAbierta> {
    await this.sembrarDemo();
    const espera = this.limitador.bloqueadoPor(d.identificador);
    if (espera) {
      throw new HttpException({ statusCode: 429, message: 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.', reintentar_en_s: espera }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const [u] = await this.q('SELECT id, usuario, rol, password_hash FROM usuarios WHERE usuario = $1 OR correo = $1', [d.identificador]);
    // Siempre se verifica un hash (el de relleno si el usuario no existe): el tiempo no revela qué cuentas existen.
    const ok = await verificarContrasena(d.contrasena, u?.password_hash ?? (await hashDeRelleno()));
    if (!u || !ok) {
      this.limitador.fallo(d.identificador);
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    this.limitador.exito(d.identificador);
    return this.abrirSesion(u, d.recordar);
  }

  private async abrirSesion(u: { id: string; usuario: string; rol: Rol }, recordar: boolean): Promise<SesionAbierta> {
    const token = randomBytes(32).toString('base64url'); // 43 caracteres, 256 bits
    const expira = new Date(Date.now() + (recordar ? TTL_RECORDAR_MS : TTL_SESION_MS));
    await this.q('DELETE FROM sesiones WHERE expira_en < now()');
    await this.q('INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES ($1, $2, $3)', [hashToken(token), u.id, expira]);
    await this.q('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [u.id]);
    return { token, expira_en: expira.toISOString(), usuario: { usuario: u.usuario, rol: u.rol } };
  }

  async usuarioPorToken(token: string): Promise<UsuarioSesion | null> {
    if (!TOKEN.test(token)) return null;
    const [u] = await this.q<UsuarioSesion>(
      `SELECT u.id, u.usuario, u.rol, u.correo, u.proposito, u.es_demo, u.creado_en, u.ultimo_acceso
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = $1 AND s.expira_en > now()`, [hashToken(token)]);
    return u ?? null;
  }

  async cerrarSesion(token: string): Promise<void> {
    await this.q('DELETE FROM sesiones WHERE token_hash = $1', [hashToken(token)]);
  }

  /** Panel de administración: sin contraseñas ni correos (solo lo necesario para administrar). */
  async resumenAdmin() {
    const [t] = await this.q(`SELECT count(*)::int AS total, count(*) FILTER (WHERE rol = 'administrador')::int AS administradores,
                                     count(*) FILTER (WHERE es_demo)::int AS demo FROM usuarios`);
    const [s] = await this.q('SELECT count(*)::int AS n FROM sesiones WHERE expira_en > now()');
    const usuarios = await this.q('SELECT usuario, rol, proposito, es_demo, creado_en, ultimo_acceso FROM usuarios ORDER BY creado_en DESC, usuario LIMIT 200');
    return { usuarios_total: t.total, administradores: t.administradores, cuentas_demo: t.demo, sesiones_activas: s.n, usuarios };
  }
}
