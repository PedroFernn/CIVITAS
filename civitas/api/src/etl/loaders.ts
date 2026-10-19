/** Carga idempotente (upsert) de zonas, unidades económicas y paradas + cálculo de atributos por zona. */
import { readFileSync } from 'node:fs';
import { Carga } from './cargas';
import { Config, TIPO_UNIDAD } from './config';
import { Conn } from './db';
import { leerDenue, leerParadas, leerZonas } from './readers';

// Caja que contiene a México continental e insular; fuera de ella la coordenada es un error de captura.
const LAT_RANGO = [14.0, 33.0];
const LON_RANGO = [-119.0, -86.0];
const LOTE = 5000;

/** Número con el formato que el ETL original (Python) usaba en mensajes: 0 → "0.0". */
const flotante = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Devuelve [lat, lon] válidos o un string con el motivo del descarte. */
export function coord(lat: string | null, lon: string | null): [number, number] | string {
  if (lat === null || lon === null) return 'sin coordenadas';
  const num = (v: string): number | undefined => {
    const t = v.trim();
    if (/^[+-]?nan$/i.test(t)) return NaN;
    if (/^[+-]?inf(inity)?$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : undefined;
  };
  const la = num(lat);
  const lo = num(lon);
  if (la === undefined || lo === undefined) return 'coordenadas no numéricas';
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return 'coordenadas no finitas';
  if (!(la >= LAT_RANGO[0] && la <= LAT_RANGO[1] && lo >= LON_RANGO[0] && lo <= LON_RANGO[1])) {
    return `coordenadas fuera de México (${flotante(la)}, ${flotante(lo)})`;
  }
  return [la, lo];
}

// ───────────────────────── Zonas (RF-1.2 · MGN) ─────────────────────────
const SQL_ZONA = `
WITH g AS (
  SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS raw
), f AS (
  SELECT raw, ST_Multi(ST_CollectionExtract(ST_MakeValid(raw), 3)) AS geom FROM g
)
INSERT INTO colonias (nombre, ciudad, geom, tipo_unidad, clave_geo, cve_ent, cve_mun, carga_id, actualizado_en)
SELECT $2, $3, f.geom, $4, $5, $6, $7, $8, now()
FROM f WHERE NOT ST_IsEmpty(f.geom) AND ST_IsValid(f.geom)
ON CONFLICT (tipo_unidad, clave_geo) DO UPDATE
  SET nombre = EXCLUDED.nombre, ciudad = EXCLUDED.ciudad, geom = EXCLUDED.geom,
      cve_ent = EXCLUDED.cve_ent, cve_mun = EXCLUDED.cve_mun, carga_id = EXCLUDED.carga_id, actualizado_en = now()
RETURNING (SELECT NOT ST_IsValid(raw) FROM f) AS reparada
`;

export async function cargarZonas(conn: Conn, cfg: Config, c: Carga): Promise<void> {
  let reparadas = 0;
  await conn.tx(async () => {
    for await (const z of leerZonas(cfg.rutaZonas!)) {
      if (z.cveEnt !== cfg.cveEnt || z.cveMun !== cfg.cveMun) continue; // fuera del municipio piloto: fuera de alcance
      c.leidos++;
      if (!z.claveGeo) { c.descartar(z.referencia, 'sin CVEGEO'); continue; }
      if (z.geojson === null) { c.descartar(z.referencia, 'sin geometría'); continue; }
      const [row] = await conn.query(SQL_ZONA, [
        z.geojson, z.nombre ?? `AGEB ${z.claveGeo}`, cfg.ciudad, TIPO_UNIDAD, z.claveGeo, z.cveEnt, z.cveMun, c.id,
      ]);
      if (!row) { c.descartar(z.referencia, 'geometría vacía o irreparable'); continue; }
      c.cargados++;
      if (row.reparada) reparadas++;
    }
  });
  if (reparadas) console.info(`Zonas con geometría inválida reparada con ST_MakeValid: ${reparadas}`);
}

// ───────────────────────── DENUE (RF-1.2) ─────────────────────────
const SQL_UE = `
INSERT INTO unidades_economicas (id_denue, nombre, codigo_act, nombre_act, estrato_personal, cve_ent, cve_mun, geom, carga_id)
SELECT t.id, t.nombre, t.codigo, t.nombre_act, t.estrato, t.ent, t.mun, ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326), $9
FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::float8[], $10::float8[])
  AS t(id, nombre, codigo, nombre_act, estrato, ent, mun, lon, lat)
ON CONFLICT (id_denue) DO UPDATE SET nombre=EXCLUDED.nombre, codigo_act=EXCLUDED.codigo_act, nombre_act=EXCLUDED.nombre_act,
  estrato_personal=EXCLUDED.estrato_personal, cve_ent=EXCLUDED.cve_ent, cve_mun=EXCLUDED.cve_mun, geom=EXCLUDED.geom,
  carga_id=EXCLUDED.carga_id
`;

type LoteUE = { id: string; nombre: string | null; codigo: string; nombreAct: string | null; estrato: string | null; ent: string; mun: string; lon: number; lat: number };

async function volcarUE(conn: Conn, lote: LoteUE[], cargaId: number) {
  if (!lote.length) return;
  await conn.query(SQL_UE, [
    lote.map((l) => l.id), lote.map((l) => l.nombre), lote.map((l) => l.codigo), lote.map((l) => l.nombreAct),
    lote.map((l) => l.estrato), lote.map((l) => l.ent), lote.map((l) => l.mun), lote.map((l) => l.lon), cargaId,
    lote.map((l) => l.lat),
  ]);
}

export async function cargarDenue(conn: Conn, cfg: Config, c: Carga): Promise<void> {
  const vistos = new Set<string>();
  let lote: LoteUE[] = [];
  await conn.tx(async () => {
    for await (const u of leerDenue(cfg.rutaDenue!)) {
      if (u.cveEnt && u.cveMun && (u.cveEnt !== cfg.cveEnt || u.cveMun !== cfg.cveMun)) continue; // fuera del municipio piloto
      c.leidos++;
      const ref = `fila ${u.fila}`;
      if (!u.idDenue) { c.descartar(ref, 'sin id de DENUE'); continue; }
      if (vistos.has(u.idDenue)) { c.descartar(`${ref} id=${u.idDenue}`, 'id duplicado en el archivo'); continue; }
      if (!u.codigoAct || !/^\d+$/.test(u.codigoAct)) { c.descartar(`${ref} id=${u.idDenue}`, 'código SCIAN faltante o inválido'); continue; }
      const co = coord(u.lat, u.lon);
      if (typeof co === 'string') { c.descartar(`${ref} id=${u.idDenue}`, co); continue; }
      vistos.add(u.idDenue);
      lote.push({ id: u.idDenue, nombre: u.nombre, codigo: u.codigoAct, nombreAct: u.nombreAct, estrato: u.estrato,
        ent: u.cveEnt ?? cfg.cveEnt, mun: u.cveMun ?? cfg.cveMun, lon: co[1], lat: co[0] });
      c.cargados++;
      if (lote.length >= LOTE) { await volcarUE(conn, lote, c.id); lote = []; }
    }
    await volcarUE(conn, lote, c.id);
  });
}

// ───────────────────────── Transporte (RF-1.2) ─────────────────────────
const SQL_PARADA = `
INSERT INTO paradas_transporte (sistema, referencia, nombre, modo, geom, carga_id)
SELECT $1, t.ref, t.nombre, t.modo, ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326), $2
FROM unnest($3::text[], $4::text[], $5::text[], $6::float8[], $7::float8[]) AS t(ref, nombre, modo, lon, lat)
ON CONFLICT (sistema, referencia) DO UPDATE SET nombre=EXCLUDED.nombre, modo=EXCLUDED.modo, geom=EXCLUDED.geom,
  carga_id=EXCLUDED.carga_id
`;

export async function cargarParadas(conn: Conn, cfg: Config, c: Carga): Promise<void> {
  const vistos = new Set<string>();
  const lote: { ref: string; nombre: string | null; modo: string; lon: number; lat: number }[] = [];
  await conn.tx(async () => {
    for await (const p of leerParadas(cfg.rutaTransporte!)) {
      c.leidos++;
      const ref = `fila ${p.fila}`;
      if (!p.referencia) { c.descartar(ref, 'sin identificador de parada'); continue; }
      if (vistos.has(p.referencia)) { c.descartar(`${ref} id=${p.referencia}`, 'id duplicado en el archivo'); continue; }
      const co = coord(p.lat, p.lon);
      if (typeof co === 'string') { c.descartar(`${ref} id=${p.referencia}`, co); continue; }
      vistos.add(p.referencia);
      lote.push({ ref: p.referencia, nombre: p.nombre, modo: p.modo ?? 'bus', lon: co[1], lat: co[0] });
      c.cargados++;
    }
    for (let i = 0; i < lote.length; i += LOTE) {
      const l = lote.slice(i, i + LOTE);
      await conn.query(SQL_PARADA, [cfg.sistemaTransporte, c.id, l.map((x) => x.ref), l.map((x) => x.nombre), l.map((x) => x.modo),
        l.map((x) => x.lon), l.map((x) => x.lat)]);
    }
  });
}

// ───────────────────────── Asignación espacial y atributos (RF-1.1) ─────────────────────────
export async function asignarYCalcularAtributos(conn: Conn, cargaId: number | null = null): Promise<void> {
  await conn.tx(async () => {
    // Punto → zona. ST_Covers incluye puntos sobre el borde; ORDER BY id hace determinista el empate.
    for (const tabla of ['unidades_economicas', 'paradas_transporte', 'listados_renta']) {
      await conn.query(`
        UPDATE ${tabla} t SET zona_id =
          (SELECT z.id FROM colonias z WHERE ST_Covers(z.geom, t.geom) ORDER BY z.id LIMIT 1)`);
    }
    await conn.query(`
      INSERT INTO zona_atributos AS za (zona_id, area_km2, num_unidades_economicas, num_comercios,
          num_comercios_mayoreo, num_comercios_menudeo, num_paradas, densidad_comercios_km2, densidad_paradas_km2,
          calculado_en, carga_id)
      SELECT z.id, ar.km2, COALESCE(ue.total,0), COALESCE(ue.comercios,0), COALESCE(ue.mayoreo,0), COALESCE(ue.menudeo,0),
             COALESCE(pa.n,0),
             ROUND(COALESCE(ue.comercios,0) / NULLIF(ar.km2,0), 2), ROUND(COALESCE(pa.n,0) / NULLIF(ar.km2,0), 2),
             now(), $1
      FROM colonias z
      CROSS JOIN LATERAL (SELECT (ST_Area(z.geom::geography) / 1e6)::numeric(12,6) AS km2) ar
      LEFT JOIN (SELECT zona_id, count(*) AS total, count(*) FILTER (WHERE es_comercio) AS comercios,
                        count(*) FILTER (WHERE LEFT(codigo_act,2) = '43') AS mayoreo,
                        count(*) FILTER (WHERE LEFT(codigo_act,2) = '46') AS menudeo
                 FROM unidades_economicas WHERE zona_id IS NOT NULL GROUP BY zona_id) ue ON ue.zona_id = z.id
      LEFT JOIN (SELECT zona_id, count(*) AS n FROM paradas_transporte WHERE zona_id IS NOT NULL GROUP BY zona_id) pa
             ON pa.zona_id = z.id
      ON CONFLICT (zona_id) DO UPDATE SET area_km2=EXCLUDED.area_km2,
          num_unidades_economicas=EXCLUDED.num_unidades_economicas, num_comercios=EXCLUDED.num_comercios,
          num_comercios_mayoreo=EXCLUDED.num_comercios_mayoreo, num_comercios_menudeo=EXCLUDED.num_comercios_menudeo,
          num_paradas=EXCLUDED.num_paradas, densidad_comercios_km2=EXCLUDED.densidad_comercios_km2,
          densidad_paradas_km2=EXCLUDED.densidad_paradas_km2, calculado_en=now(), carga_id=EXCLUDED.carga_id
    `, [cargaId]);
  });
}

/** Regla reproducible (ADR-001): de las AGEB del municipio con ≥ minComercios comercios, ordenadas por CVEGEO,
 *  se toman N espaciadas uniformemente (muestreo sistemático). Se puede forzar con --lista-piloto. */
export async function seleccionarPilotos(conn: Conn, cfg: Config): Promise<number> {
  await conn.tx(async () => {
    await conn.query('UPDATE colonias SET es_piloto = FALSE WHERE ciudad = $1', [cfg.ciudad]);
    if (cfg.listaPiloto) {
      const claves = readFileSync(cfg.listaPiloto, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      await conn.query('UPDATE colonias SET es_piloto = TRUE WHERE tipo_unidad=$1 AND clave_geo = ANY($2)', [TIPO_UNIDAD, claves]);
    } else {
      const ids = (await conn.query(
        'SELECT z.id FROM colonias z JOIN zona_atributos a ON a.zona_id = z.id ' +
          'WHERE z.cve_ent=$1 AND z.cve_mun=$2 AND a.num_comercios >= $3 ORDER BY z.clave_geo',
        [cfg.cveEnt, cfg.cveMun, cfg.minComercios])).map((r) => r.id);
      const n = cfg.zonasPiloto;
      const total = ids.length;
      const elegidos = total <= n ? ids : Array.from({ length: n }, (_, i) => ids[Math.floor((i * total) / n)]);
      await conn.query('UPDATE colonias SET es_piloto = TRUE WHERE id = ANY($1::uuid[])', [elegidos]);
    }
  });
  return Number((await conn.one('SELECT count(*) AS n FROM colonias WHERE es_piloto')).n);
}

/** Evita mezclar datos sintéticos con reales: borra lo cargado por corridas de otro modo. */
export async function limpiarOtroModo(conn: Conn, modo: string): Promise<void> {
  await conn.tx(async () => {
    for (const tabla of ['listados_renta', 'unidades_economicas', 'paradas_transporte', 'colonias']) {
      await conn.query(`DELETE FROM ${tabla} WHERE carga_id IN (SELECT id FROM cargas_datos WHERE modo <> $1)`, [modo]);
    }
  });
}
