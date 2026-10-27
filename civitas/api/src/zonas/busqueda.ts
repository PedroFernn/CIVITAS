/** Búsqueda de zonas: normalización y ranking puros (sin BD) para poder probarlos aparte. */

/** Minúsculas y sin diacríticos: «Sintético» → «sintetico». */
export const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const MAX_Q = 60;

/** Un número de 1–3 dígitos («4», «04») es un número de zona: se busca solo en el nombre. Todos los CVEGEO de un municipio comparten dígitos, así que en la clave no distingue nada. */
export const esNumeroCorto = (t: string): boolean => /^\d{1,3}$/.test(t);

/** Texto de búsqueda → términos normalizados (todos deben aparecer). Sin términos si solo hay espacios. */
export function terminos(q: string | undefined): string[] {
  return normalizar((q ?? '').slice(0, MAX_Q)).split(/\s+/).filter(Boolean).slice(0, 6);
}

/** Escapa los comodines de LIKE para que «50%» o «a_b» se busquen literalmente. */
export const escaparLike = (t: string): string => t.replace(/[\\%_]/g, '\\$&');

export interface ZonaBuscable { nombre: string; clave_geo: string | null; ciudad: string | null; n_listados?: number }

/** Cuánto coincide un término con la zona (mayor = mejor). Un número suelto es exacto si coincide con una palabra: «4» ≈ «04». */
function puntuarTermino(z: { nombre: string; clave: string; palabras: string[]; ciudad: string }, t: string): number {
  const corto = esNumeroCorto(t);
  if (z.nombre === t || (!corto && z.clave === t)) return 100;
  if (/^\d+$/.test(t) && z.palabras.some((w) => /^\d+$/.test(w) && Number(w) === Number(t))) return 90;
  if (!corto && z.clave.startsWith(t)) return 80;
  if (z.nombre.startsWith(t)) return 75;
  if (z.palabras.some((w) => w.startsWith(t))) return 60;
  if (!corto && z.clave.includes(t)) return 40;
  if (z.nombre.includes(t)) return 30;
  return !corto && z.ciudad.includes(t) ? 10 : 0;
}

export function puntuar(zona: ZonaBuscable, ts: string[]): number {
  if (!ts.length) return 0;
  const nombre = normalizar(zona.nombre);
  const z = { nombre, clave: zona.clave_geo ?? '', palabras: nombre.split(/\s+/), ciudad: normalizar(zona.ciudad ?? '') };
  return ts.reduce((s, t) => s + puntuarTermino(z, t), 0) / ts.length;
}

/** Ordena por puntaje; a igualdad, la zona con más listados y luego por nombre. */
export function ordenarPorRelevancia<T extends ZonaBuscable>(zonas: T[], ts: string[]): T[] {
  return zonas
    .map((z) => ({ z, p: puntuar(z, ts) }))
    .sort((a, b) => b.p - a.p || (b.z.n_listados ?? 0) - (a.z.n_listados ?? 0) || a.z.nombre.localeCompare(b.z.nombre, 'es', { numeric: true }))
    .map((x) => x.z);
}
