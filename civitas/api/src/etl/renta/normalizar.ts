/** Normalización de listados de renta (RF-1.2): precio, m², recámaras, tipo, fecha y URL. Funciones puras, sin BD. */
import { createHash } from 'node:crypto';
import { TipoInmueble } from './tipos';

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string };
const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const fallo = (motivo: string): Resultado<never> => ({ ok: false, motivo });

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Número con separadores de México: "12,500.50", "12500", "12 500", "65,5" (coma decimal) o "1.250,50".
 * Ojo: "12.500" se lee como 12.5 (el punto es decimal en México); si era 12 500, el rango de precio lo marcará como error.
 */
export function aNumero(bruto: string): number | null {
  let t = bruto.replace(/\s+/g, '');
  if (!t) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

const MONEDA_MXN = /^(mxn|mn|m\.n\.|peso|pesos|\$)$/i;
const MONEDA_USD = /usd|dlls|d[oó]lar|us\$/i;

/** Renta mensual en pesos. Descarta lo que no sea pesos (no se convierte) y lo implausible (típico error de captura). */
export function normalizarPrecio(texto: string | null, moneda: string | null, min: number, max: number): Resultado<number> {
  if (texto === null || texto.trim() === '') return fallo('precio faltante');
  const mon = (moneda ?? '').trim();
  if (MONEDA_USD.test(texto) || MONEDA_USD.test(mon)) return fallo('moneda no soportada (USD)');
  if (mon && !MONEDA_MXN.test(mon)) return fallo(`moneda no soportada (${mon.toUpperCase()})`);
  const t = texto
    .toLowerCase()
    .replace(/m\.n\./g, ' ')
    .replace(/\b(mxn|mn|pesos?|mensuales?|al mes|por mes|mes)\b/g, ' ')
    .replace(/[$/]/g, ' ')
    .trim();
  const n = aNumero(t);
  if (n === null) return fallo('precio no numérico');
  if (n < min || n > max) return fallo(`precio fuera de rango (${n})`);
  return ok(Math.round(n * 100) / 100);
}

export const SUPERFICIE_MIN = 8;
export const SUPERFICIE_MAX = 1500;

export function normalizarSuperficie(texto: string | null): Resultado<number> {
  if (texto === null || texto.trim() === '') return fallo('superficie faltante');
  const t = texto.trim().toLowerCase().replace(/\s*(metros\s+cuadrados|metros|mts\s*2|mts2|mts|mt2|mt|m\s*2|m2|m²|m)\.?\s*$/, '');
  const n = aNumero(t);
  if (n === null) return fallo('superficie no numérica');
  if (n < SUPERFICIE_MIN || n > SUPERFICIE_MAX) return fallo(`superficie fuera de rango (${n})`);
  return ok(Math.round(n * 100) / 100);
}

/** 0 = estudio/loft/monoambiente. "2", "2 rec", "3+" y "4 o más" se leen por su primer entero. */
export function normalizarRecamaras(texto: string | null): Resultado<number> {
  if (texto === null || texto.trim() === '') return fallo('recámaras faltantes');
  const t = sinAcentos(texto.trim().toLowerCase());
  if (/^(estudio|studio|loft|monoambiente)\b/.test(t)) return ok(0);
  const m = t.match(/^(\d+)/);
  if (!m) return fallo('recámaras no numéricas');
  const n = Number(m[1]);
  if (n > 10) return fallo(`recámaras fuera de rango (${n})`);
  return ok(n);
}

export function normalizarTipo(texto: string | null): TipoInmueble {
  const t = sinAcentos((texto ?? '').toLowerCase());
  if (/\b(depa|depto|dpto|departamento|apartamento|penthouse|loft|studio|estudio)/.test(t)) return 'departamento';
  if (/\b(casa|residencia|townhouse|duplex)/.test(t)) return 'casa';
  if (/\b(cuarto|habitacion|room)/.test(t)) return 'cuarto';
  return 'otro';
}

/** AAAA-MM-DD, AAAA-MM, DD/MM/AAAA o ISO con hora → "AAAA-MM-DD". Fechas imposibles o futuras → null (no es campo clave). */
export function normalizarFecha(texto: string | null, hoy: Date = new Date()): string | null {
  if (!texto) return null;
  const t = texto.trim();
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(?:$|[T\s])/))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3] ?? 1)];
  else if ((r = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  if (f.getTime() > hoy.getTime() + 24 * 3600 * 1000) return null;
  return f.toISOString().slice(0, 10);
}

/** Solo http(s), sin credenciales, query ni fragmento (los parámetros suelen llevar identificadores); sin enlaces de contacto. */
export function sanitizarUrl(texto: string | null): string | null {
  if (!texto) return null;
  try {
    const u = new URL(texto.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (/(^|\.)wa\.me$|whatsapp/i.test(u.hostname)) return null;
    const limpia = `${u.origin}${u.pathname}`;
    if (limpia.includes('@') || limpia.length > 500) return null;
    return limpia;
  } catch {
    return null;
  }
}

export interface DatosHuella {
  tipo: TipoInmueble;
  precio: number;
  superficie: number;
  recamaras: number | null;
  lat: number;
  lon: number;
}

/**
 * Huella de la oferta: misma fuente, tipo, precio, superficie, recámaras y ubicación (4 decimales ≈ 11 m) = misma oferta
 * republicada. Es una heurística (dos unidades iguales en un mismo edificio colisionarían); por eso exige superficie
 * y el reporte de calidad cuenta cuántos listados se descartaron por esta causa.
 */
export function huella(d: DatosHuella): string {
  const base = [d.tipo, d.precio.toFixed(2), d.superficie.toFixed(2), d.recamaras ?? '', d.lat.toFixed(4), d.lon.toFixed(4)].join('|');
  return createHash('sha256').update(base).digest('hex').slice(0, 32);
}
