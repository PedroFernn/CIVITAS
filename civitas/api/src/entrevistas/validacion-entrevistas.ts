import { BadRequestException } from '@nestjs/common';

export const TIPOS_ENTREVISTA = ['inquilino', 'b2b'] as const;
export type TipoEntrevista = (typeof TIPOS_ENTREVISTA)[number];
export const MODALIDADES = ['presencial', 'remota'] as const;
/** MVP-5 (plan de sprints): 5 entrevistas cortas de precio, 3 a inquilinos o estudiantes y 2 a inmobiliarias o administradoras. */
export const OBJETIVO_ENTREVISTAS: Record<TipoEntrevista, number> = { inquilino: 3, b2b: 2 };
export const MIN_CARACTERES_NOTAS = 20;

export interface EntrevistaEntrada {
  tipo: TipoEntrevista;
  alias: string;
  realizada_en: string;                  // YYYY-MM-DD
  modalidad: (typeof MODALIDADES)[number];
  duracion_min: number | null;
  zona_id: string | null;
  renta_actual_mxn: number | null;
  renta_justa_mxn: number | null;
  acepta_pagar: boolean | null;
  monto_dispuesto_mxn: number | null;
  notas: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORREO = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const TELEFONO = /(?<!\d)(?:\d{10}|\d{2}[\s-]\d{4}[\s-]\d{4}|\+?52[\s-]?\d{10})(?!\d)/;

const vacio = (v: unknown) => v === undefined || v === null || v === '';

function entero(v: unknown, nombre: string, min: number, max: number): number | null {
  if (vacio(v)) return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${nombre} debe ser un entero entre ${min} y ${max}`);
  return n;
}

function fecha(v: unknown): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
    throw new BadRequestException('realizada_en debe ser una fecha AAAA-MM-DD');
  }
  if (v > new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)) throw new BadRequestException('realizada_en no puede ser una fecha futura');
  return v;
}

/** Valida el cuerpo de POST/PUT /entrevistas. Todo lo que pasa va después parametrizado al SQL. */
export function parseEntrevista(body: unknown): EntrevistaEntrada {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('El cuerpo debe ser un objeto JSON');
  const b = body as Record<string, unknown>;

  if (!(TIPOS_ENTREVISTA as readonly unknown[]).includes(b.tipo)) throw new BadRequestException(`tipo debe ser ${TIPOS_ENTREVISTA.join('|')}`);
  const alias = typeof b.alias === 'string' ? b.alias.trim() : '';
  if (alias.length < 2 || alias.length > 60) throw new BadRequestException('alias debe tener de 2 a 60 caracteres (un seudónimo, p. ej. «Inquilina 1»)');
  if (CORREO.test(alias) || /\d{7,}/.test(alias.replace(/[\s-]/g, ''))) {
    throw new BadRequestException('El alias no debe incluir correo ni teléfono: usa un seudónimo (p. ej. «Inquilina 1»)');
  }
  const modalidad = vacio(b.modalidad) ? 'presencial' : b.modalidad;
  if (!(MODALIDADES as readonly unknown[]).includes(modalidad)) throw new BadRequestException(`modalidad debe ser ${MODALIDADES.join('|')}`);

  const notas = typeof b.notas === 'string' ? b.notas.trim() : '';
  if (notas.length < MIN_CARACTERES_NOTAS) throw new BadRequestException(`notas debe tener al menos ${MIN_CARACTERES_NOTAS} caracteres (qué dijo del precio y por qué)`);
  if (notas.length > 4000) throw new BadRequestException('notas admite hasta 4000 caracteres');
  if (CORREO.test(notas) || TELEFONO.test(notas)) throw new BadRequestException('Las notas no deben incluir correos ni teléfonos de la persona entrevistada');

  if (!vacio(b.zona_id) && !(typeof b.zona_id === 'string' && UUID.test(b.zona_id))) throw new BadRequestException('zona_id debe ser un UUID');
  if (!vacio(b.acepta_pagar) && typeof b.acepta_pagar !== 'boolean') throw new BadRequestException('acepta_pagar debe ser true|false');
  const acepta = vacio(b.acepta_pagar) ? null : (b.acepta_pagar as boolean);
  const monto = entero(b.monto_dispuesto_mxn, 'monto_dispuesto_mxn', 0, 100_000);
  if (monto !== null && acepta !== true) throw new BadRequestException('monto_dispuesto_mxn solo aplica si acepta_pagar es true');

  return {
    tipo: b.tipo as TipoEntrevista,
    alias,
    realizada_en: fecha(b.realizada_en),
    modalidad: modalidad as EntrevistaEntrada['modalidad'],
    duracion_min: entero(b.duracion_min, 'duracion_min', 1, 240),
    zona_id: vacio(b.zona_id) ? null : (b.zona_id as string),
    renta_actual_mxn: entero(b.renta_actual_mxn, 'renta_actual_mxn', 1_000, 250_000),
    renta_justa_mxn: entero(b.renta_justa_mxn, 'renta_justa_mxn', 1_000, 250_000),
    acepta_pagar: acepta,
    monto_dispuesto_mxn: monto,
    notas,
  };
}

export interface ResumenEntrevistas {
  total: number;
  por_tipo: Record<TipoEntrevista, { hechas: number; objetivo: number }>;
  con_notas: number;
  completas: boolean;                    // 3 inquilinos + 2 B2B, todas con notas
  b2b_aceptarian_pagar: number;          // criterio go/no-go del 2 dic: ≥2 de 5
  faltan: string[];
}

/** Avance contra el objetivo del sprint: solo cuentan las entrevistas con notas guardadas. */
export function resumirEntrevistas(filas: { tipo: TipoEntrevista; notas: string | null; acepta_pagar: boolean | null }[]): ResumenEntrevistas {
  const validas = filas.filter((f) => (f.notas ?? '').trim().length >= MIN_CARACTERES_NOTAS);
  const hechas = (t: TipoEntrevista) => validas.filter((f) => f.tipo === t).length;
  const por_tipo = {
    inquilino: { hechas: hechas('inquilino'), objetivo: OBJETIVO_ENTREVISTAS.inquilino },
    b2b: { hechas: hechas('b2b'), objetivo: OBJETIVO_ENTREVISTAS.b2b },
  };
  const faltan: string[] = [];
  const nombre: Record<TipoEntrevista, string> = { inquilino: 'inquilino(s) o estudiante(s)', b2b: 'inmobiliaria(s) o administradora(s)' };
  for (const t of TIPOS_ENTREVISTA) {
    const f = por_tipo[t].objetivo - por_tipo[t].hechas;
    if (f > 0) faltan.push(`${f} ${nombre[t]}`);
  }
  return {
    total: filas.length,
    por_tipo,
    con_notas: validas.length,
    completas: faltan.length === 0,
    b2b_aceptarian_pagar: validas.filter((f) => f.tipo === 'b2b' && f.acepta_pagar === true).length,
    faltan,
  };
}
