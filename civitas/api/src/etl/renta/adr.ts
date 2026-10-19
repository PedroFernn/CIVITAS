/** Lectura del ADR-002: decisión (scraping vs. captura manual) y revisión de términos de uso, en un encabezado `clave: valor`. */
import { existsSync, readFileSync } from 'node:fs';

export interface Adr {
  existe: boolean;
  campos: Record<string, string>;
}

export function leerAdr(archivo: string): Adr {
  if (!existsSync(archivo)) return { existe: false, campos: {} };
  const texto = readFileSync(archivo, 'utf8').replace(/^\uFEFF/, '');
  const campos: Record<string, string> = {};
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (m) {
    for (const linea of m[1].split(/\r?\n/)) {
      const k = linea.match(/^([a-z_]+):\s*(.*)$/i);
      if (k) campos[k[1].toLowerCase()] = k[2].replace(/(^|\s+)#.*$/, '').trim();
    }
  }
  return { existe: true, campos };
}

export const DECISIONES = ['captura_manual', 'scraping'] as const;

/** AAAA-MM-DD que existe en el calendario (Date.parse acepta "2026-02-31", por eso se comprueba la ida y vuelta). */
function fechaCalendarioValida(f: string): boolean {
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mes - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mes - 1 && t.getUTCDate() === d;
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export interface EstadoAdr {
  existe: boolean;
  decision: string | null; // válida o null
  aceptada: boolean;
  /** Campos de la revisión de términos que faltan o son inválidos. */
  faltanTerminos: string[];
  terminosPermiten: boolean;
}

export function evaluarAdr(adr: Adr): EstadoAdr {
  const c = adr.campos;
  const decision = (DECISIONES as readonly string[]).includes(c.decision ?? '') ? c.decision : null;
  const faltan: string[] = [];
  if (!c.portal) faltan.push('portal');
  if (!/^https?:\/\/\S+$/.test(c.terminos_url ?? '')) faltan.push('terminos_url');
  const f = c.terminos_revisados_en ?? '';
  if (!fechaCalendarioValida(f)) faltan.push('terminos_revisados_en');
  if (!c.terminos_revisados_por) faltan.push('terminos_revisados_por');
  const permite = sinAcentos(c.terminos_permiten_uso ?? '').toLowerCase();
  if (permite !== 'si' && permite !== 'no') faltan.push('terminos_permiten_uso');
  return {
    existe: adr.existe,
    decision,
    aceptada: (c.estado ?? '').toLowerCase() === 'aceptada',
    faltanTerminos: faltan,
    terminosPermiten: permite === 'si',
  };
}
