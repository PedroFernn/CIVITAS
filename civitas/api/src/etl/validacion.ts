/** Checklist "PARA PASAR" de MVP-2 como código ejecutable (ver docs/mvp2/MVP2.md). */
import { existsSync, readFileSync } from 'node:fs';
import { ADR_UNIDAD_ZONA, Config, TIPO_UNIDAD } from './config';
import { Conn } from './db';

export interface Check {
  id: string;
  requisito: string; // RF-1.1 / RF-1.2 / RNF-INT / RNF-CAL / RNF-TRZ / UNIDAD
  descripcion: string;
  estado: 'ok' | 'fail' | 'warn';
  detalle: string;
}

export async function ejecutar(conn: Conn, cfg: Config): Promise<Check[]> {
  const out: Check[] = [];

  // 1 ── ≥30 zonas piloto con polígono (RF-1.2)
  const n = Number((await conn.one(
    "SELECT count(*) AS n FROM colonias WHERE es_piloto AND geom IS NOT NULL AND NOT ST_IsEmpty(geom) " +
      "AND GeometryType(geom) IN ('POLYGON','MULTIPOLYGON')")).n);
  out.push({ id: 'zonas_piloto', requisito: 'RF-1.2', descripcion: `≥${cfg.zonasPiloto} zonas piloto de ${cfg.ciudad} con polígono`,
    estado: n >= cfg.zonasPiloto ? 'ok' : 'fail', detalle: `${n} zonas piloto con polígono` });

  // 2 ── conteo de comercios y de paradas en cada zona piloto (RF-1.1)
  const r = await conn.one(`SELECT count(*) AS zonas, count(a.zona_id) AS con_attr,
          COALESCE(sum(a.num_comercios),0) AS comercios, COALESCE(sum(a.num_paradas),0) AS paradas
     FROM colonias z LEFT JOIN zona_atributos a ON a.zona_id = z.id WHERE z.es_piloto`);
  const [zonas, conAttr, comercios, paradas] = [r.zonas, r.con_attr, r.comercios, r.paradas].map(Number);
  out.push({ id: 'atributos_por_zona', requisito: 'RF-1.1', descripcion: 'Conteo de comercios y de paradas en cada zona piloto',
    estado: zonas > 0 && conAttr === zonas && comercios > 0 && paradas > 0 ? 'ok' : 'fail',
    detalle: `${conAttr}/${zonas} zonas con atributos · ${comercios} comercios · ${paradas} paradas` });

  // 3 ── sin geometrías inválidas (RNF calidad)
  const inval = Number((await conn.one('SELECT count(*) AS n FROM colonias WHERE NOT ST_IsValid(geom) OR ST_IsEmpty(geom)')).n);
  const restr = Number((await conn.one("SELECT count(*) AS n FROM pg_constraint WHERE conname='colonias_geom_valida'")).n);
  out.push({ id: 'sin_geometrias_invalidas', requisito: 'RNF-CAL', descripcion: 'Sin geometrías inválidas (verificado y forzado por CHECK en BD)',
    estado: inval === 0 && restr === 1 ? 'ok' : 'fail',
    detalle: `${inval} inválidas · restricción colonias_geom_valida ${restr ? 'presente' : 'AUSENTE'}` });

  // 4 ── trazabilidad: fuente y fecha de cada carga (RNF trazabilidad)
  const huerfanos = Number((await conn.one(`SELECT (SELECT count(*) FROM colonias WHERE carga_id IS NULL) +
          (SELECT count(*) FROM unidades_economicas WHERE carga_id IS NULL) +
          (SELECT count(*) FROM paradas_transporte WHERE carga_id IS NULL) AS n`)).n);
  const fuentes = new Map((await conn.query(`SELECT DISTINCT ON (fuente_clave) fuente_clave, estado, finalizada_en, sha256, archivo_origen
     FROM cargas_datos ORDER BY fuente_clave, id DESC`)).map((f) => [f.fuente_clave as string, f]));
  const esperadas = ['inegi_mgn', 'inegi_denue', 'transporte_paradas'];
  const faltan = esperadas.filter((k) => !fuentes.has(k)).sort();
  const mal = esperadas.filter((k) => fuentes.has(k)).filter((k) => {
    const f = fuentes.get(k)!;
    return f.estado !== 'ok' || f.finalizada_en === null || !f.sha256 || !f.archivo_origen;
  }).sort();
  out.push({ id: 'trazabilidad', requisito: 'RNF-TRZ', descripcion: 'Fuente y fecha (más archivo y hash) de cada carga',
    estado: huerfanos === 0 && !faltan.length && !mal.length ? 'ok' : 'fail',
    detalle: `${huerfanos} registros sin carga · fuentes sin carga: ${lista(faltan)} · cargas incompletas: ${lista(mal)}` });

  // 5 ── unidad de zona decidida y documentada
  const tipos = (await conn.query('SELECT DISTINCT tipo_unidad FROM colonias WHERE es_piloto')).map((x) => x.tipo_unidad as string);
  const docOk = existsSync(ADR_UNIDAD_ZONA) && readFileSync(ADR_UNIDAD_ZONA, 'utf8').toUpperCase().includes(TIPO_UNIDAD.toUpperCase());
  out.push({ id: 'unidad_de_zona', requisito: 'DOC', descripcion: 'Unidad de zona decidida y documentada (colonia, AGEB o H3)',
    estado: tipos.length === 1 && tipos[0] === TIPO_UNIDAD && docOk ? 'ok' : 'fail',
    detalle: `unidad en datos: ${tipos.length ? lista(tipos) : "['ninguna']"} · ADR-001 ${docOk ? 'presente' : 'AUSENTE'}` });

  // 6 ── no mezclar sintético con real (RNF calidad)
  const modos = (await conn.query(
    'SELECT DISTINCT cd.modo FROM colonias z JOIN cargas_datos cd ON cd.id = z.carga_id WHERE z.es_piloto')).map((x) => x.modo as string);
  out.push({ id: 'origen_unico', requisito: 'RNF-CAL', descripcion: 'Zonas piloto de un solo origen (sin mezclar sintético y real)',
    estado: modos.length === 1 ? 'ok' : 'fail', detalle: `modos: ${modos.length ? lista(modos) : "['ninguno']"}` });

  // 7 ── aviso: datos sintéticos
  if (modos.length === 1 && modos[0] === 'fixture') {
    out.push({ id: 'datos_reales', requisito: 'AVISO', descripcion: 'Datos reales de INEGI y transporte', estado: 'warn',
      detalle: 'La carga actual usa datos SINTÉTICOS (modo fixture). Para datos reales: --fuente real' });
  }
  return out;
}

/** Formato de lista heredado del ETL original ("['a', 'b']" / 'ninguna') para conservar los mensajes. */
const lista = (xs: string[]) => (xs.length ? `[${xs.map((x) => `'${x}'`).join(', ')}]` : 'ninguna');

export async function guardar(conn: Conn, checks: Check[], modo: string): Promise<boolean> {
  const aprobada = checks.every((c) => c.estado !== 'fail');
  await conn.tx(() => conn.query('INSERT INTO mvp2_validaciones (aprobada, modo, resultados) VALUES ($1,$2,$3)',
    [aprobada, modo, JSON.stringify(checks)]));
  return aprobada;
}

export function imprimir(checks: Check[]): void {
  const icono = { ok: '✔', fail: '✘', warn: '!' };
  for (const c of checks) console.log(`  [${icono[c.estado]}] ${c.requisito.padEnd(8)} ${c.descripcion}\n        → ${c.detalle}`);
}
