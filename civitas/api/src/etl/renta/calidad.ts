/** Reporte de calidad de una carga de listados (PARA PASAR: "Reporte de calidad generado"). */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Config, REPORTS } from '../config';
import { Conn } from '../db';
import { aObjeto, CAMPOS_CLAVE, CampoClave, EstadisticasCarga } from './estadisticas';

export interface Distribucion { n: number; min: number; p25: number; mediana: number; p75: number; max: number }

export interface ReporteCalidad {
  version: 1;
  generado_en: string;
  modo: string;
  fuente: string;
  carga_id: number;
  archivo_origen: string | null;
  sha256: string | null;
  comando: string | null;
  umbrales: { min_listados_con_zona: number; max_tasa_nulos: number; rango_precio_mxn: [number, number] };
  totales: {
    leidos: number; cargados: number; descartados: number; republicaciones_descartadas: number; sin_huella: number;
    con_zona: number; sin_zona: number; en_zonas_piloto: number;
    acumulado: { listados: number; con_zona: number };
  };
  /** Campos clave: precio, superficie_m2, recamaras y coordenadas. Se evalúan todas las filas leídas, también las descartadas. */
  campos_clave: {
    evaluados: number; con_algun_nulo: number; tasa_nulos: number;
    por_campo: Record<CampoClave, { nulos: number; tasa: number; motivos: Record<string, number> }>;
  };
  descartes_por_motivo: Record<string, number>;
  columnas_sensibles_ignoradas: string[];
  distribucion: { precio_mxn: Distribucion | null; precio_m2: Distribucion | null; por_tipo: Record<string, number>; por_recamaras: Record<string, number> };
  zonas: { con_listados: number; piloto_con_listados: number; total_piloto: number };
  resultado: { cumple_min_listados: boolean; cumple_umbral_nulos: boolean };
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

async function distribucion(conn: Conn, columna: 'precio_mxn' | 'precio_m2', cargaId: number): Promise<Distribucion | null> {
  const d = await conn.one(
    `SELECT count(${columna})::int AS n, min(${columna})::float AS min,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY ${columna})::float AS p25,
            percentile_cont(0.5)  WITHIN GROUP (ORDER BY ${columna})::float AS mediana,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY ${columna})::float AS p75, max(${columna})::float AS max
     FROM listados_renta WHERE carga_id = $1`, [cargaId]);
  return d.n === 0 ? null : (d as Distribucion);
}

export async function generarReporte(conn: Conn, cfg: Config, cargaId: number, est: EstadisticasCarga): Promise<ReporteCalidad> {
  const carga = await conn.one('SELECT * FROM cargas_datos WHERE id = $1', [cargaId]);
  const t = await conn.one(
    `SELECT count(*)::int AS cargados, count(l.zona_id)::int AS con_zona,
            count(*) FILTER (WHERE z.es_piloto)::int AS en_piloto
     FROM listados_renta l LEFT JOIN colonias z ON z.id = l.zona_id WHERE l.carga_id = $1`, [cargaId]);
  const acum = await conn.one('SELECT count(*)::int AS listados, count(zona_id)::int AS con_zona FROM listados_renta WHERE fuente_clave = $1', [carga.fuente_clave]);
  const zonas = await conn.one(
    `SELECT (SELECT count(DISTINCT l.zona_id) FROM listados_renta l WHERE l.carga_id = $1)::int AS con_listados,
            (SELECT count(DISTINCT l.zona_id) FROM listados_renta l JOIN colonias z ON z.id = l.zona_id
              WHERE l.carga_id = $1 AND z.es_piloto)::int AS piloto_con_listados,
            (SELECT count(*) FROM colonias WHERE es_piloto)::int AS total_piloto`, [cargaId]);
  const porTipo = await conn.query('SELECT tipo_inmueble AS k, count(*)::int AS n FROM listados_renta WHERE carga_id = $1 GROUP BY 1 ORDER BY 1', [cargaId]);
  const porRec = await conn.query("SELECT COALESCE(recamaras::text, 'sin dato') AS k, count(*)::int AS n FROM listados_renta WHERE carga_id = $1 GROUP BY 1 ORDER BY 1", [cargaId]);

  const evaluados = est.evaluados;
  const tasa = evaluados ? est.conAlgunNulo / evaluados : 0;
  const porCampo = Object.fromEntries(
    CAMPOS_CLAVE.map((c) => [c, { nulos: est.nulos[c], tasa: r4(evaluados ? est.nulos[c] / evaluados : 0), motivos: aObjeto(est.invalidosPorCampo[c]) }]),
  ) as ReporteCalidad['campos_clave']['por_campo'];

  return {
    version: 1,
    generado_en: new Date().toISOString(),
    modo: carga.modo,
    fuente: carga.fuente_clave,
    carga_id: cargaId,
    archivo_origen: carga.archivo_origen ? path.basename(carga.archivo_origen) : null,
    sha256: carga.sha256,
    comando: carga.comando,
    umbrales: { min_listados_con_zona: cfg.minListados, max_tasa_nulos: cfg.umbralNulos, rango_precio_mxn: [cfg.precioMin, cfg.precioMax] },
    totales: {
      leidos: carga.registros_leidos, cargados: carga.registros_cargados, descartados: carga.registros_descartados,
      republicaciones_descartadas: est.duplicados, sin_huella: est.sinHuella,
      con_zona: t.con_zona, sin_zona: t.cargados - t.con_zona, en_zonas_piloto: t.en_piloto,
      acumulado: { listados: acum.listados, con_zona: acum.con_zona },
    },
    campos_clave: { evaluados, con_algun_nulo: est.conAlgunNulo, tasa_nulos: r4(tasa), por_campo: porCampo },
    descartes_por_motivo: aObjeto(est.descartesPorMotivo),
    columnas_sensibles_ignoradas: est.columnasSensibles,
    distribucion: {
      precio_mxn: await distribucion(conn, 'precio_mxn', cargaId),
      precio_m2: await distribucion(conn, 'precio_m2', cargaId),
      por_tipo: Object.fromEntries(porTipo.map((x) => [x.k, x.n])),
      por_recamaras: Object.fromEntries(porRec.map((x) => [x.k, x.n])),
    },
    zonas: { con_listados: zonas.con_listados, piloto_con_listados: zonas.piloto_con_listados, total_piloto: zonas.total_piloto },
    resultado: { cumple_min_listados: acum.con_zona >= cfg.minListados, cumple_umbral_nulos: evaluados > 0 && tasa < cfg.umbralNulos },
  };
}

export async function guardarReporte(conn: Conn, r: ReporteCalidad): Promise<void> {
  await conn.tx(() =>
    conn.query(
      'INSERT INTO reportes_calidad (carga_id, resumen) VALUES ($1, $2) ' +
        'ON CONFLICT (carga_id) DO UPDATE SET resumen = EXCLUDED.resumen, generado_en = now()',
      [r.carga_id, JSON.stringify(r)],
    ),
  );
}

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
const mxn = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });

export function aMarkdown(r: ReporteCalidad): string {
  const L: string[] = [];
  L.push(`# Reporte de calidad · MVP-3 · listados de renta`, '');
  L.push(`- Fuente: \`${r.fuente}\` · modo: **${r.modo === 'fixture' ? 'sintético (fixture)' : r.modo}** · carga #${r.carga_id}`);
  L.push(`- Archivo: \`${r.archivo_origen ?? 'n/d'}\` · SHA-256: \`${r.sha256 ?? 'n/d'}\``);
  L.push(`- Generado: ${r.generado_en}`, '');
  L.push('## Resultado', '');
  L.push(`- Listados con zona asignada (acumulado): **${r.totales.acumulado.con_zona}** (mínimo ${r.umbrales.min_listados_con_zona}) → ${r.resultado.cumple_min_listados ? 'cumple' : 'NO cumple'}`);
  L.push(`- Listados leídos con algún campo clave nulo: **${pct(r.campos_clave.tasa_nulos)}** (${r.campos_clave.con_algun_nulo} de ${r.campos_clave.evaluados}; umbral < ${pct(r.umbrales.max_tasa_nulos)}, propuesto) → ${r.resultado.cumple_umbral_nulos ? 'cumple' : 'NO cumple'}`, '');
  L.push('## Esta carga', '');
  L.push(`| Leídos | Cargados | Descartados | Con zona | Sin zona | En zonas piloto |`, '|---:|---:|---:|---:|---:|---:|');
  const t = r.totales;
  L.push(`| ${t.leidos} | ${t.cargados} | ${t.descartados} | ${t.con_zona} | ${t.sin_zona} | ${t.en_zonas_piloto} |`, '');
  L.push('## Campos clave nulos o inválidos', '', '| Campo | Filas | % de leídas | Motivos |', '|---|---:|---:|---|');
  for (const c of CAMPOS_CLAVE) {
    const x = r.campos_clave.por_campo[c];
    L.push(`| ${c} | ${x.nulos} | ${pct(x.tasa)} | ${Object.entries(x.motivos).map(([m, n]) => `${m}: ${n}`).join('; ') || '—'} |`);
  }
  L.push('', '## Descartes por motivo', '');
  const d = Object.entries(r.descartes_por_motivo);
  if (d.length) { L.push('| Motivo | Filas |', '|---|---:|'); for (const [m, n] of d) L.push(`| ${m} | ${n} |`); } else L.push('Ninguno.');
  L.push('', '## Distribución (esta carga)', '');
  for (const [nombre, x, f] of [['Renta mensual (MXN)', r.distribucion.precio_mxn, mxn], ['Renta por m² (MXN)', r.distribucion.precio_m2, mxn]] as const) {
    L.push(x ? `- ${nombre}: n=${x.n} · mín ${f(x.min)} · p25 ${f(x.p25)} · mediana ${f(x.mediana)} · p75 ${f(x.p75)} · máx ${f(x.max)}` : `- ${nombre}: sin datos`);
  }
  L.push(`- Por tipo: ${Object.entries(r.distribucion.por_tipo).map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}`);
  L.push(`- Por recámaras: ${Object.entries(r.distribucion.por_recamaras).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'}`, '');
  L.push(`## Zonas`, '', `${r.zonas.con_listados} zonas con listados (${r.zonas.piloto_con_listados} de ${r.zonas.total_piloto} zonas piloto).`, '');
  L.push('## Privacidad', '');
  L.push(r.columnas_sensibles_ignoradas.length
    ? `⚠ El archivo de origen trae columnas que **no se leyeron ni se guardaron**: ${r.columnas_sensibles_ignoradas.map((c) => `\`${c}\``).join(', ')}. Elimínalas del archivo fuente.`
    : 'El archivo de origen no trae columnas de contacto ni de texto libre.');
  L.push('');
  return L.join('\n');
}

/** Copia en disco (data/reports). La fuente de verdad es la BD (reportes_calidad); si el directorio no es escribible solo se avisa. */
export function escribirArchivosReporte(r: ReporteCalidad): void {
  try {
    mkdirSync(REPORTS, { recursive: true });
    writeFileSync(path.join(REPORTS, 'mvp3_calidad.json'), JSON.stringify(r, null, 2), 'utf8');
    writeFileSync(path.join(REPORTS, 'mvp3_calidad.md'), aMarkdown(r), 'utf8');
  } catch (e) {
    console.warn(`No se pudo escribir data/reports (${(e as Error).message}); el reporte sigue disponible en la API: GET /listados-renta/calidad`);
  }
}
