'use server';
import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { tokenActual } from '@/lib/sesion';

export interface EstadoEntrevista {
  error?: string;
  /** Lo escrito se devuelve para no obligar a teclearlo de nuevo. */
  campos?: Record<string, string>;
}

const texto = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string).trim() : '');
const CAMPOS = ['tipo', 'alias', 'realizada_en', 'modalidad', 'duracion_min', 'zona_id', 'renta_actual_mxn', 'renta_justa_mxn', 'acepta_pagar', 'monto_dispuesto_mxn', 'notas'] as const;

async function llamar(metodo: 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await tokenActual();
  if (!token) redirect('/iniciar-sesion?siguiente=/admin/entrevistas');
  let r: Response;
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      method: metodo, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.' };
  }
  if (r.ok) return { ok: true };
  if (r.status === 401 || r.status === 403) return { ok: false, error: 'Tu sesión venció o no tienes permiso para esta sección.' };
  const j: any = await r.json().catch(() => ({}));
  return { ok: false, error: r.status === 400 ? String(Array.isArray(j.message) ? j.message[0] : j.message ?? 'Datos no válidos.') : 'No se pudo guardar la entrevista.' };
}

/** Crea una entrevista, o la corrige si el formulario trae `id`. */
export async function guardarEntrevista(_: EstadoEntrevista, f: FormData): Promise<EstadoEntrevista> {
  const campos = Object.fromEntries([...CAMPOS, 'id'].map((k) => [k, texto(f, k)]));
  const acepta = campos.acepta_pagar === 'si' ? true : campos.acepta_pagar === 'no' ? false : null;
  const cuerpo = { ...Object.fromEntries(CAMPOS.map((k) => [k, campos[k]])), acepta_pagar: acepta };
  const id = campos.id;
  const r = id ? await llamar('PUT', `/entrevistas/${encodeURIComponent(id)}`, cuerpo) : await llamar('POST', '/entrevistas', cuerpo);
  if (!r.ok) return { error: r.error, campos };
  redirect('/admin/entrevistas?guardada=1');
}

export async function eliminarEntrevista(f: FormData) {
  const id = texto(f, 'id');
  const r = await llamar('DELETE', `/entrevistas/${encodeURIComponent(id)}`);
  redirect(r.ok ? '/admin/entrevistas?eliminada=1' : '/admin/entrevistas');
}
