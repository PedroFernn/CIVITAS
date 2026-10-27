'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { destinoPorRol, rutaInterna, SESION_COOKIE, tokenActual, type Rol } from '@/lib/sesion';

export interface EstadoForm {
  error?: string;
  /** Lo escrito se devuelve para no obligar a teclearlo de nuevo (nunca las contraseñas). */
  campos?: { identificador?: string; usuario?: string; correo?: string; proposito?: string };
}

interface Sesion { token: string; expira_en: string; usuario: { usuario: string; rol: Rol } }
const campo = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '');

async function llamar(ruta: string, cuerpo: unknown): Promise<{ ok: true; sesion: Sesion } | { ok: false; error: string }> {
  let r: Response;
  try {
    r = await fetch(`${API_URL}${ruta}`, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.' };
  }
  const j: any = await r.json().catch(() => ({}));
  if (r.ok) return { ok: true, sesion: j as Sesion };
  if (r.status === 429) return { ok: false, error: `Demasiados intentos fallidos. Espera ${Math.max(1, Math.ceil((j.reintentar_en_s ?? 60) / 60))} min antes de volver a intentar.` };
  if (r.status === 401) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  if (r.status === 400 || r.status === 409) return { ok: false, error: String(Array.isArray(j.message) ? j.message[0] : j.message ?? 'Datos no válidos.') };
  return { ok: false, error: 'El servicio de cuentas no está disponible por ahora.' };
}

async function guardarCookie(s: Sesion, recordar: boolean) {
  const seguro = (await headers()).get('x-forwarded-proto') === 'https';   // Caddy lo envía; en http://localhost no se marca Secure
  (await cookies()).set(SESION_COOKIE, s.token, {
    httpOnly: true, sameSite: 'lax', secure: seguro, path: '/',
    ...(recordar ? { expires: new Date(s.expira_en) } : {}),              // sin "recordarme": cookie de sesión (se borra al cerrar el navegador)
  });
}

export async function iniciarSesion(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const identificador = campo(f, 'identificador'), recordar = f.get('recordar') === 'on';
  const r = await llamar('/auth/login', { identificador, contrasena: campo(f, 'contrasena'), recordar });
  if (!r.ok) return { error: r.error, campos: { identificador } };
  await guardarCookie(r.sesion, recordar);
  redirect(rutaInterna(campo(f, 'siguiente')) ?? destinoPorRol(r.sesion.usuario.rol));
}

export async function registrar(_: EstadoForm, f: FormData): Promise<EstadoForm> {
  const campos = { usuario: campo(f, 'usuario'), correo: campo(f, 'correo'), proposito: campo(f, 'proposito') };
  if (campo(f, 'contrasena') !== campo(f, 'contrasena2')) return { error: 'Las contraseñas no coinciden.', campos };
  const r = await llamar('/auth/registro', { ...campos, contrasena: campo(f, 'contrasena'), acepta_aviso: f.get('acepta_aviso') === 'on' });
  if (!r.ok) return { error: r.error, campos };
  await guardarCookie(r.sesion, false);
  redirect(destinoPorRol(r.sesion.usuario.rol));
}

export async function cerrarSesion() {
  const token = await tokenActual();
  if (token) await fetch(`${API_URL}/auth/logout`, { method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  (await cookies()).delete(SESION_COOKIE);
  redirect('/iniciar-sesion');
}
