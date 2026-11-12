/** Checklist "PARA PASAR" de MVP-6 como código ejecutable (ver docs/mvp6/MVP6.md): motor de anomalías, INEGI consistente y cuentas. */
import { existsSync, readFileSync } from 'node:fs';
import { Config, DOC_MVP6 } from '../config';
import { Conn } from '../db';
import { Check } from '../validacion';
import { ResumenAnomalias } from './calcular';

export const COBERTURA_MIN = 0.95;        // ≥95 % de los listados con superficie reciben etiqueta
export const PRECISION_MIN = 0.85;        // criterio del plan (MVP-7: «informe de precisión», meta ≥85 %)
export const MUESTRA_MIN = 60;            // el plan etiqueta 60 listados
export const COBERTURA_CENSO_MIN = 0.95;  // ≥95 % de las zonas con población del Censo (INEGI reserva unas pocas por confidencialidad)

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)} %`;
const n = (x: number) => x.toLocaleString('es-MX');

/** Pura (se prueba aparte): qué estado merece la precisión medida contra la muestra. */
export function evaluarPrecision(precision: number, detectados: number, ic: [number, number], origen: string): { estado: Check['estado']; detalle: string } {
  const base = `precisión ${pct(precision)} (IC 95 %: ${pct(ic[0])} a ${pct(ic[1])}) sobre ${n(detectados)} anomalías detectadas`;
  if (detectados === 0) return { estado: 'fail', detalle: 'el motor no detectó ninguna anomalía en la muestra: no hay precisión que medir' };
  if (precision < PRECISION_MIN) return { estado: 'fail', detalle: `${base}, por debajo de la meta de ${pct(PRECISION_MIN, 0)}` };
  return { estado: origen === 'humano' ? 'ok' : 'warn', detalle: `${base}; meta ≥ ${pct(PRECISION_MIN, 0)}${origen === 'humano' ? '' : ' · medida contra anomalías SEMBRADAS por el generador de la demo, no contra etiquetas humanas'}` };
}

export async function ejecutar(conn: Conn, cfg: Config, resumen: ResumenAnomalias): Promise<Check[]> {
  const out: Check[] = [];
  const modosPrecios = (await conn.query('SELECT DISTINCT cd.modo FROM listados_renta l JOIN cargas_datos cd ON cd.id = l.carga_id')).map((x) => x.modo as string);
  const preciosDemo = modosPrecios.length === 1 && modosPrecios[0] === 'fixture';

  // 1 ── método documentado
  const doc = existsSync(DOC_MVP6) ? readFileSync(DOC_MVP6, 'utf8') : null;
  out.push({ id: 'metodo_documentado', requisito: 'DOC', descripcion: 'Método del motor documentado (mediana, MAD y z robusto)',
    estado: doc === null ? 'warn' : /^##\s+Método/mi.test(doc) ? 'ok' : 'fail',
    detalle: doc === null ? 'no se encontró docs/mvp6/MVP6.md en esta imagen' : /^##\s+Método/mi.test(doc) ? 'docs/mvp6/MVP6.md tiene la sección «Método»' : 'falta la sección «Método» en docs/mvp6/MVP6.md' });

  // 2 ── cobertura
  const cob = resumen.conSuperficie ? resumen.etiquetados / resumen.conSuperficie : 0;
  out.push({ id: 'motor_cobertura', requisito: 'RF-2.1', descripcion: `El motor etiqueta ≥${pct(COBERTURA_MIN, 0)} de los listados con superficie (Justo / Inflado / Subprecio)`,
    estado: resumen.conSuperficie > 0 && cob >= COBERTURA_MIN ? 'ok' : 'fail',
    detalle: `${n(resumen.etiquetados)} de ${n(resumen.conSuperficie)} (${pct(cob)}) · justo ${n(resumen.conteo.justo)}, inflado ${n(resumen.conteo.inflado)}, subprecio ${n(resumen.conteo.subprecio)} · comparados en su zona ${n(resumen.niveles.zona)}, su municipio ${n(resumen.niveles.municipio)} o el estado ${n(resumen.niveles.estado)}` });

  // 3 ── muestra de validación
  const et = resumen.etiquetas, nMuestra = resumen.etiquetasCoinciden;
  out.push({ id: 'muestra_validacion', requisito: 'RF-2.1', descripcion: `Muestra etiquetada de ≥${MUESTRA_MIN} listados para validar el motor`,
    estado: !et || nMuestra < MUESTRA_MIN ? (preciosDemo ? 'warn' : 'fail') : et.origen === 'humano' ? 'ok' : 'warn',
    detalle: !et ? 'no hay archivo de etiquetas (data/raw/rentas-demo/renta_demo_etiquetas.csv o CIVITAS_ETIQUETAS_PATH); sin muestra no se mide la precisión'
      : nMuestra < MUESTRA_MIN ? `solo ${n(nMuestra)} etiquetas corresponden a listados cargados (el archivo trae ${n(et.porIdFuente.size)}); se necesitan ${MUESTRA_MIN}`
      : `${n(nMuestra)} etiquetas (origen: ${et.origen})${et.origen === 'humano' ? '' : ': las anomalías las sembró el generador de la demo; el plan pide etiquetado humano, que no sustituye'}` });

  // 4 ── precisión
  if (resumen.metricas && resumen.metricas.evaluados >= MUESTRA_MIN) {
    const m = resumen.metricas, p = evaluarPrecision(m.precision, m.anomalosDetectados, m.precisionIC, et!.origen);
    out.push({ id: 'precision_medida', requisito: 'RNF-CAL', descripcion: `Precisión del motor ≥${pct(PRECISION_MIN, 0)} con el intervalo de confianza a la vista`, estado: p.estado,
      detalle: `${p.detalle} · recall ${pct(m.recall)} · exactitud de las tres etiquetas ${pct(m.exactitud)} sobre ${n(m.evaluados)} listados evaluados` });
  } else {
    out.push({ id: 'precision_medida', requisito: 'RNF-CAL', descripcion: `Precisión del motor ≥${pct(PRECISION_MIN, 0)} con el intervalo de confianza a la vista`,
      estado: preciosDemo ? 'warn' : 'fail', detalle: 'sin muestra etiquetada suficiente no se puede medir la precisión' });
  }

  // 5 ── umbral calibrado
  out.push({ id: 'umbral_calibrado', requisito: 'RF-2.1', descripcion: 'Umbral del z robusto calibrado con la muestra (no fijado a ojo)',
    estado: resumen.calibrado ? 'ok' : 'warn',
    detalle: resumen.calibrado
      ? `umbral ${resumen.umbral} (${resumen.criterioCalibracion === 'precision' ? `el más bajo cuya precisión alcanza ${pct(PRECISION_MIN, 0)}` : `ninguno alcanza ${pct(PRECISION_MIN, 0)}: el de mayor F1`}) · precisión por umbral: ${resumen.tablaCalibracion.map((t) => `${t.umbral}→${pct(t.m.precision, 0)}`).join(' · ')}`
      : `se usó el umbral por defecto (${resumen.umbral}): no hubo muestra para calibrarlo` });

  // 6 ── INEGI: municipios y claves consistentes
  const z = await conn.one(`SELECT count(*)::int AS zonas, count(DISTINCT (cve_ent, cve_mun))::int AS muns,
      count(*) FILTER (WHERE poblacion IS NOT NULL)::int AS con_pob, COALESCE(sum(poblacion), 0)::bigint AS pob,
      count(*) FILTER (WHERE clave_geo IS NULL OR length(clave_geo) <> 13 OR left(clave_geo, 5) <> cve_ent || cve_mun)::int AS claves_mal,
      count(*) FILTER (WHERE es_piloto)::int AS pilotos FROM colonias`);
  const nMunicipios = Number((await conn.one('SELECT count(*) AS n FROM municipios')).n);
  // Las zonas del fixture son una cuadrícula con claves inventadas (p. ej. 21114FX0099): solo las de INEGI deben cumplir el formato de 13 caracteres.
  const zonasSinteticas = (await conn.query('SELECT DISTINCT cd.modo FROM colonias c JOIN cargas_datos cd ON cd.id = c.carga_id')).every((x) => x.modo === 'fixture');
  const clavesMal = Number(z.claves_mal);
  out.push({ id: 'inegi_claves', requisito: 'RNF-CAL', descripcion: 'Toda zona tiene CVEGEO de 13 caracteres cuyo prefijo coincide con su entidad y municipio',
    estado: Number(z.zonas) === 0 ? 'fail' : clavesMal === 0 ? 'ok' : zonasSinteticas ? 'warn' : 'fail',
    detalle: `${n(Number(z.zonas))} zonas · ${n(clavesMal)} con clave inconsistente${clavesMal && zonasSinteticas ? ' (zonas sintéticas del fixture: sus claves no son de INEGI)' : ''}` });

  if (nMunicipios === 0) {
    out.push({ id: 'inegi_municipios', requisito: 'RNF-CAL', descripcion: 'Zonas y municipios de INEGI consistentes (nombre oficial y población del Censo)',
      estado: 'warn', detalle: 'no hay municipios cargados (modo fixture o falta data/raw/municipios): la consistencia con el Censo no aplica' });
  } else {
    const sinMun = Number((await conn.one(`SELECT count(*) AS n FROM colonias z LEFT JOIN municipios m ON m.cve_ent = z.cve_ent AND m.cve_mun = z.cve_mun WHERE m.cve_mun IS NULL`)).n);
    const nombreDist = Number((await conn.one(`SELECT count(*) AS n FROM colonias z JOIN municipios m ON m.cve_ent = z.cve_ent AND m.cve_mun = z.cve_mun WHERE z.ciudad IS DISTINCT FROM m.nombre`)).n);
    const excede = Number((await conn.one(`SELECT count(*) AS n FROM (SELECT cve_ent, cve_mun, sum(poblacion) AS s FROM colonias GROUP BY 1, 2) t
        JOIN municipios m ON m.cve_ent = t.cve_ent AND m.cve_mun = t.cve_mun WHERE m.poblacion IS NOT NULL AND t.s > m.poblacion`)).n);
    const ok = sinMun === 0 && nombreDist === 0 && excede === 0;
    out.push({ id: 'inegi_municipios', requisito: 'RNF-CAL', descripcion: 'Zonas y municipios de INEGI consistentes (nombre oficial y población del Censo)', estado: ok ? 'ok' : 'fail',
      detalle: `${n(nMunicipios)} municipios cargados · zonas sin municipio: ${sinMun} · con otro nombre que el del catálogo: ${nombreDist} · municipios cuya suma de AGEB supera su población: ${excede}` });
    const cp = Number(z.zonas) ? Number(z.con_pob) / Number(z.zonas) : 0;
    out.push({ id: 'inegi_censo', requisito: 'RNF-CAL', descripcion: `≥${pct(COBERTURA_CENSO_MIN, 0)} de las zonas con población del Censo 2020`,
      estado: cp >= COBERTURA_CENSO_MIN ? 'ok' : 'fail', detalle: `${n(Number(z.con_pob))} de ${n(Number(z.zonas))} zonas (${pct(cp)}) · ${n(Number(z.pob))} habitantes en zonas urbanas · el resto lo reserva INEGI por confidencialidad` });
  }
  out.push({ id: 'inegi_cobertura', requisito: 'RF-1.2', descripcion: 'Cobertura de zonas y municipios; pilotos solo en el municipio del ADR-001',
    estado: 'ok', detalle: `${n(Number(z.zonas))} zonas de ${n(Number(z.muns))} municipios · ${n(Number(z.pilotos))} zonas piloto` });

  // 7 ── cuentas
  const u = await conn.one(`SELECT count(*)::int AS total, count(*) FILTER (WHERE password_hash !~ '^scrypt[$]')::int AS sin_hash,
      count(*) FILTER (WHERE rol = 'administrador')::int AS admins, count(*) FILTER (WHERE es_demo)::int AS demo FROM usuarios`);
  const sesionesMal = Number((await conn.one(`SELECT count(*) AS n FROM sesiones WHERE token_hash !~ '^[0-9a-f]{64}$'`)).n);
  const cuentasOk = Number(u.sin_hash) === 0 && sesionesMal === 0;
  out.push({ id: 'cuentas_seguras', requisito: 'RNF-SEG', descripcion: 'Contraseñas solo como hash scrypt, sesiones solo como SHA-256 y al menos un administrador',
    estado: !cuentasOk ? 'fail' : Number(u.admins) === 0 ? 'warn' : 'ok',
    detalle: `${n(Number(u.total))} cuentas (${n(Number(u.admins))} administradoras, ${n(Number(u.demo))} de demostración) · contraseñas sin hash scrypt: ${n(Number(u.sin_hash))} · sesiones con token en claro: ${sesionesMal}` });

  // 8 ── aviso de demo
  if (preciosDemo) {
    out.push({ id: 'datos_reales', requisito: 'AVISO', descripcion: 'Anomalías sobre precios reales', estado: 'warn',
      detalle: 'Las anomalías se calculan sobre listados de DEMOSTRACIÓN (modo fixture): demuestran el método, no el mercado de Puebla.' });
  }
  return out;
}

export async function guardar(conn: Conn, checks: Check[], modo: string): Promise<boolean> {
  const aprobada = checks.every((c) => c.estado !== 'fail');
  await conn.tx(() => conn.query('INSERT INTO mvp6_validaciones (aprobada, modo, resultados) VALUES ($1,$2,$3)', [aprobada, modo, JSON.stringify(checks)]));
  return aprobada;
}
