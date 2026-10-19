/** Checklist "PARA PASAR" de MVP-3 como código ejecutable (ver docs/mvp3/MVP3.md). El modo (sintético/real) se toma de los datos. */
import { Config } from '../config';
import { Conn } from '../db';
import { Check } from '../validacion';
import { evaluarAdr, leerAdr } from './adr';
import { ReporteCalidad } from './calidad';
import { PARSERS } from './registro';

const lista = (xs: string[]) => (xs.length ? `[${xs.map((x) => `'${x}'`).join(', ')}]` : 'ninguna');
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

/** Nombres de columna que nunca deben existir en la tabla de listados (privacidad por diseño). */
export const COLUMNA_PERSONAL = /(tel|cel|whats|phone|fono|contact|anunciante|vendedor|propietari|due[ñn]o|agente|asesor|correo|mail|persona|nombre|descrip|titulo|comentari)/i;

export async function ejecutar(conn: Conn, cfg: Config): Promise<Check[]> {
  const out: Check[] = [];

  const modos = (await conn.query('SELECT DISTINCT cd.modo FROM listados_renta l JOIN cargas_datos cd ON cd.id = l.carga_id ORDER BY 1')).map((x) => x.modo as string);
  const modo = modos.length === 1 ? modos[0] : null; // sin datos o mezcla → se aplica el criterio estricto (real)
  const sintetico = modo === 'fixture';

  const rep = await conn.one<{ carga_id: string; generado_en: string; resumen: ReporteCalidad }>(
    `SELECT r.carga_id, r.generado_en, r.resumen FROM reportes_calidad r JOIN cargas_datos c ON c.id = r.carga_id
     WHERE c.fuente_clave = $1 ORDER BY r.carga_id DESC LIMIT 1`, [cfg.fuenteRenta]);

  // 1 ── ≥300 listados con zona asignada (RF-1.2)
  const z = await conn.one('SELECT count(*)::int AS total, count(zona_id)::int AS con_zona FROM listados_renta');
  out.push({ id: 'listados_con_zona', requisito: 'RF-1.2', descripcion: `≥${cfg.minListados} listados de renta con zona asignada`,
    estado: z.con_zona >= cfg.minListados ? 'ok' : 'fail', detalle: `${z.con_zona} con zona de ${z.total} cargados` });

  // 2 ── <10 % con campos clave nulos (umbral propuesto)
  if (rep) {
    const c = rep.resumen.campos_clave;
    out.push({ id: 'campos_clave_nulos', requisito: 'RNF-CAL', descripcion: `<${pct(cfg.umbralNulos)} de listados con campos clave nulos (umbral propuesto)`,
      estado: c.evaluados > 0 && c.tasa_nulos < cfg.umbralNulos ? 'ok' : 'fail',
      detalle: `${pct(c.tasa_nulos)} (${c.con_algun_nulo} de ${c.evaluados} leídos; precio, m², recámaras o coordenadas) en la carga #${rep.resumen.carga_id}` });
  } else {
    out.push({ id: 'campos_clave_nulos', requisito: 'RNF-CAL', descripcion: `<${pct(cfg.umbralNulos)} de listados con campos clave nulos (umbral propuesto)`,
      estado: 'fail', detalle: 'no hay reporte de calidad: no se puede medir' });
  }

  // 3 ── reporte de calidad generado
  const secciones = ['totales', 'campos_clave', 'descartes_por_motivo', 'distribucion', 'zonas'];
  const faltan = rep ? secciones.filter((s) => !(s in rep.resumen)) : secciones;
  out.push({ id: 'reporte_calidad', requisito: 'RNF-CAL', descripcion: 'Reporte de calidad generado',
    estado: rep && !faltan.length ? 'ok' : 'fail',
    detalle: rep ? `carga #${rep.carga_id}${faltan.length ? ` · secciones faltantes: ${lista(faltan)}` : ' · disponible en GET /listados-renta/calidad y data/reports/mvp3_calidad.md'}` : 'no se ha generado ningún reporte' });

  // 4 ── decisión scraping o captura manual, por escrito (ADR-002)
  const adr = evaluarAdr(leerAdr(cfg.adrRenta));
  const estadoAdr = adr.aceptada ? 'aceptada' : 'propuesta';
  const decisionOk = adr.decision !== null && (sintetico || adr.aceptada);
  out.push({ id: 'decision_fuente', requisito: 'DOC', descripcion: 'Decisión scraping o captura manual, por escrito (ADR-002)',
    estado: decisionOk ? 'ok' : 'fail',
    detalle: !adr.existe ? 'ADR-002 AUSENTE' : adr.decision === null ? 'ADR-002 sin una decisión válida (captura_manual | scraping)'
      : `decisión: ${adr.decision} · estado: ${estadoAdr}${!sintetico && !adr.aceptada ? ' · con datos reales debe estar aceptada' : ''}` });

  // 5 ── términos de uso de la fuente revisados (RNF Legalidad)
  const terminosOk = adr.faltanTerminos.length === 0 && adr.terminosPermiten;
  out.push({ id: 'legalidad_terminos', requisito: 'RNF-LEG', descripcion: 'Términos de uso de la fuente revisados (ADR-002)',
    estado: terminosOk ? 'ok' : sintetico ? 'warn' : 'fail',
    detalle: terminosOk ? 'revisión registrada y el uso está permitido'
      : adr.faltanTerminos.length ? `${sintetico ? 'datos sintéticos: no aplica todavía. ' : ''}falta en ADR-002: ${lista(adr.faltanTerminos)}`
      : 'los términos de la fuente NO permiten este uso: no cargar datos reales de ese portal' });

  // 6 ── privacidad: ni teléfono ni nombre del anunciante (RNF Privacidad)
  const cols = (await conn.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listados_renta'"))
    .map((c) => c.column_name as string);
  const colsPersonales = cols.filter((c) => COLUMNA_PERSONAL.test(c));
  const contacto = Number((await conn.one(
    "SELECT count(*) AS n FROM listados_renta WHERE url ~* '(wa\\.me|whatsapp|tel:|mailto:|@)' OR id_fuente ~ '@'")).n);
  const ignoradas = rep?.resumen.columnas_sensibles_ignoradas ?? [];
  out.push({ id: 'privacidad', requisito: 'RNF-PRIV', descripcion: 'No se guarda teléfono ni nombre del anunciante',
    estado: colsPersonales.length || contacto ? 'fail' : ignoradas.length ? 'warn' : 'ok',
    detalle: `columnas personales en la tabla: ${lista(colsPersonales)} · enlaces/ids con datos de contacto: ${contacto}` +
      (ignoradas.length ? ` · el archivo de origen trae columnas que NO se leyeron: ${lista(ignoradas)} (elimínalas del archivo)` : '') });

  // 7 ── interoperabilidad: un parser aislado por fuente (RNF Interoperabilidad)
  const enBd = (await conn.query('SELECT DISTINCT fuente_clave FROM listados_renta ORDER BY 1')).map((x) => x.fuente_clave as string);
  const definidas = new Set((await conn.query('SELECT clave FROM fuentes_datos')).map((x) => x.clave as string));
  const sinParser = enBd.filter((k) => !PARSERS.has(k));
  const sinFuente = [...PARSERS.keys()].filter((k) => !definidas.has(k));
  out.push({ id: 'parser_por_fuente', requisito: 'RNF-INT', descripcion: 'Listados de 1 fuente, con un parser aislado y registrado',
    estado: enBd.length === 1 && !sinParser.length && !sinFuente.length ? 'ok' : 'fail',
    detalle: `fuentes con listados: ${lista(enBd)} · sin parser registrado: ${lista(sinParser)} · parsers sin fila en fuentes_datos: ${lista(sinFuente)}` });

  // 8 ── deduplicación (RF-1.2)
  const dup = Number((await conn.one(`SELECT
      (SELECT count(*) FROM (SELECT 1 FROM listados_renta GROUP BY fuente_clave, id_fuente HAVING count(*) > 1) a) +
      (SELECT count(*) FROM (SELECT 1 FROM listados_renta WHERE huella IS NOT NULL GROUP BY fuente_clave, huella HAVING count(*) > 1) b) AS n`)).n);
  const idx = Number((await conn.one("SELECT count(*) AS n FROM pg_indexes WHERE indexname = 'idx_listados_huella'")).n);
  out.push({ id: 'deduplicacion', requisito: 'RF-1.2', descripcion: 'Listados deduplicados (por id y por huella de la oferta)',
    estado: dup === 0 && idx === 1 ? 'ok' : 'fail',
    detalle: `${dup} duplicados · índice único por huella ${idx ? 'presente' : 'AUSENTE'}` +
      (rep ? ` · republicaciones descartadas en la última carga: ${rep.resumen.totales.republicaciones_descartadas}` : '') });

  // 9 ── origen único y coherente con las zonas (RNF calidad)
  const modosZonas = (await conn.query('SELECT DISTINCT cd.modo FROM colonias z JOIN cargas_datos cd ON cd.id = z.carga_id ORDER BY 1')).map((x) => x.modo as string);
  out.push({ id: 'origen_unico', requisito: 'RNF-CAL', descripcion: 'Listados de un solo origen y del mismo origen que las zonas (sin mezclar sintético y real)',
    estado: modo !== null && modosZonas.length === 1 && modosZonas[0] === modo ? 'ok' : 'fail',
    detalle: `modo de los listados: ${lista(modos)} · modo de las zonas: ${lista(modosZonas)}` });

  // 10 ── aviso: datos sintéticos
  if (sintetico) {
    out.push({ id: 'datos_reales', requisito: 'AVISO', descripcion: 'Listados de renta reales', estado: 'warn',
      detalle: 'La carga actual usa listados SINTÉTICOS (modo fixture), no precios reales. Para datos reales: --fuente real (antes, completa ADR-002)' });
  }
  return out;
}

export async function guardar(conn: Conn, checks: Check[], modo: string): Promise<boolean> {
  const aprobada = checks.every((c) => c.estado !== 'fail');
  await conn.tx(() => conn.query('INSERT INTO mvp3_validaciones (aprobada, modo, resultados) VALUES ($1,$2,$3)', [aprobada, modo, JSON.stringify(checks)]));
  return aprobada;
}
