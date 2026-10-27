import { cookies } from 'next/headers';
import { API_URL } from './api';

/** La sesión vive en una cookie HttpOnly de la web (el navegador nunca ve el token desde JavaScript). */
export const SESION_COOKIE = 'civitas_sesion';

export type Rol = 'usuario' | 'administrador';
export interface Cuenta {
  usuario: string; rol: Rol; correo: string | null; proposito: string | null;
  es_demo: boolean; creado_en: string; ultimo_acceso: string | null;
}

export const ETIQUETA_ROL: Record<Rol, string> = { usuario: 'Usuario', administrador: 'Administrador' };
/** P-11: a dónde lleva el acceso según el rol (lo decide el sistema, no el usuario). */
export const destinoPorRol = (rol: Rol) => (rol === 'administrador' ? '/admin' : '/mi-cuenta');

/** Solo rutas internas ("/algo"): evita redirigir a sitios externos tras iniciar sesión (open redirect). */
export function rutaInterna(r: unknown): string | null {
  return typeof r === 'string' && /^\/(?![/\\])[A-Za-z0-9/_\-?=&.%]*$/.test(r) ? r : null;
}

export async function tokenActual(): Promise<string | null> {
  return (await cookies()).get(SESION_COOKIE)?.value ?? null;
}

/** Cuenta de la sesión actual, o null (sin cookie, sesión vencida o API caída: la página sigue siendo pública). */
export async function usuarioActual(): Promise<{ cuenta: Cuenta; token: string } | null> {
  const token = await tokenActual();
  if (!token) return null;
  try {
    const r = await fetch(`${API_URL}/auth/me`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? { cuenta: (await r.json()) as Cuenta, token } : null;
  } catch {
    return null;
  }
}

export async function estadoDemo(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/auth/estado`, { cache: 'no-store' });
    return r.ok && (await r.json()).demo === true;
  } catch {
    return false;
  }
}
