/** Pruebas de integración contra PostGIS: el criterio de aceptación de MVP-2 ejecutado de verdad. */
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { conCarga } from '../../src/etl/cargas';
import { Config, nuevaConfig, resolverRutas } from '../../src/etl/config';
import { Conn, conectar, migrar } from '../../src/etl/db';
import { cargarZonas } from '../../src/etl/loaders';
import { correrMvp2 } from '../../src/etl/pipeline';
import * as validacion from '../../src/etl/validacion';
import { escribirShapefile } from '../helpers/shapefile';
import { prepararBdPruebas, TEST_DB_URL } from '../helpers/db';

let hayBd = false;
let conn: Conn;
const cfg = (p: Partial<Config> = {}) => nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest', ...p });
const n = async (sql: string, ...p: unknown[]) => Number((await conn.one(sql, p)).n);

beforeAll(async () => {
  hayBd = await prepararBdPruebas();
  if (hayBd) conn = await conectar(TEST_DB_URL);
});
afterAll(async () => { await conn?.close(); });

/** Corre el pipeline completo DESDE CERO (como `etl mvp2 --desde-cero`). */
async function corrida() {
  expect(await correrMvp2(cfg(), true, true)).toBe(true);
}

const si = (nombre: string, fn: () => Promise<void>, ms = 60_000) =>
  it(nombre, async () => { if (!hayBd) return; await fn(); }, ms);

describe('ETL MVP-2 (PostGIS)', () => {
  si('desde cero cumple "para pasar"', async () => {
    await corrida();
    expect(await n("SELECT count(*) AS n FROM colonias WHERE es_piloto AND NOT ST_IsEmpty(geom)")).toBeGreaterThanOrEqual(30);
    expect(await n('SELECT count(*) AS n FROM colonias WHERE NOT ST_IsValid(geom)')).toBe(0);
    expect(await n('SELECT count(*) AS n FROM v_zonas_piloto WHERE num_comercios IS NULL OR num_paradas IS NULL')).toBe(0);
    const ultimo = await conn.one('SELECT aprobada, resultados FROM mvp2_validaciones ORDER BY id DESC LIMIT 1');
    expect(ultimo.aprobada).toBe(true);
    expect(ultimo.resultados.filter((c: any) => c.estado === 'fail')).toEqual([]);
  });

  si('geometría inválida reparada y AGEB de otro municipio omitida', async () => {
    await corrida();
    const r = await conn.one("SELECT ST_IsValid(geom) AS ok, GeometryType(geom) AS t FROM colonias WHERE clave_geo='21114FX0099'");
    expect(r.ok).toBe(true);
    expect(r.t).toBe('MULTIPOLYGON');
    expect(await n("SELECT count(*) AS n FROM colonias WHERE clave_geo='21041FX0001'")).toBe(0);
  });

  si('la BD rechaza geometría inválida', async () => {
    await corrida();
    await expect(conn.query("INSERT INTO colonias (nombre, ciudad, geom, clave_geo) VALUES ('mala','Puebla', " +
      "ST_Multi(ST_GeomFromText('POLYGON((0 0,1 1,1 0,0 1,0 0))',4326)), 'MALA')")).rejects.toMatchObject({ code: '23514' });
  });

  si('descartes registrados con motivo', async () => {
    await corrida();
    const denue = await conn.one("SELECT * FROM cargas_datos WHERE fuente_clave='inegi_denue' ORDER BY id DESC LIMIT 1");
    expect(denue.registros_descartados).toBe(5);
    expect(denue.registros_cargados).toBe(denue.registros_leidos - 5);
    const motivos = new Set((await conn.query('SELECT motivo FROM cargas_descartes WHERE carga_id=$1', [denue.id])).map((r) => r.motivo.split(' (')[0]));
    for (const m of ['sin coordenadas', 'coordenadas no numéricas', 'coordenadas fuera de México', 'código SCIAN faltante o inválido', 'id duplicado en el archivo']) {
      expect(motivos).toContain(m);
    }
    const par = await conn.one("SELECT * FROM cargas_datos WHERE fuente_clave='transporte_paradas' ORDER BY id DESC LIMIT 1");
    expect(par.registros_descartados).toBe(2);
  });

  si('trazabilidad: fuente, fecha y hash', async () => {
    await corrida();
    for (const f of ['inegi_mgn', 'inegi_denue', 'transporte_paradas']) {
      const c = await conn.one('SELECT * FROM cargas_datos WHERE fuente_clave=$1 ORDER BY id DESC LIMIT 1', [f]);
      expect(c.estado).toBe('ok');
      expect(c.finalizada_en).toBeTruthy();
      expect(c.sha256).toHaveLength(64);
      expect(c.archivo_origen).toBeTruthy();
      expect(c.comando).toBeTruthy();
      expect(await n('SELECT count(*) AS n FROM fuentes_datos WHERE clave=$1 AND ultima_ingesta IS NOT NULL', f)).toBe(1);
    }
    for (const t of ['colonias', 'unidades_economicas', 'paradas_transporte']) {
      expect(await n(`SELECT count(*) AS n FROM ${t} WHERE carga_id IS NULL`)).toBe(0);
    }
  });

  si('idempotente: una segunda corrida no duplica', async () => {
    await corrida();
    const tablas = ['colonias', 'unidades_economicas', 'paradas_transporte', 'zona_atributos'];
    const conteos = async () => Object.fromEntries(await Promise.all(tablas.map(async (t) => [t, await n(`SELECT count(*) AS n FROM ${t}`)])));
    const pilotos = async () => (await conn.query('SELECT clave_geo FROM colonias WHERE es_piloto')).map((r) => r.clave_geo).sort();
    const [antes, p0] = [await conteos(), await pilotos()];
    expect(await correrMvp2(cfg())).toBe(true);
    expect(await conteos()).toEqual(antes);
    expect(await pilotos()).toEqual(p0);
    expect(await n("SELECT count(*) AS n FROM cargas_datos WHERE fuente_clave='inegi_denue'")).toBe(2); // cada corrida deja su rastro
  });

  si('conteos consistentes con una consulta independiente', async () => {
    await corrida();
    expect(await n(`SELECT count(*) AS n FROM zona_atributos a JOIN colonias z ON z.id = a.zona_id
      WHERE a.num_comercios <> (SELECT count(*) FROM unidades_economicas u WHERE u.es_comercio AND ST_Covers(z.geom, u.geom))
         OR a.num_paradas   <> (SELECT count(*) FROM paradas_transporte p WHERE ST_Covers(z.geom, p.geom))`)).toBe(0);
    expect(await n('SELECT count(*) AS n FROM unidades_economicas WHERE zona_id IS NULL')).toBeGreaterThanOrEqual(1);
  });

  si('una importación fallida queda registrada como error', async () => {
    const c2 = cfg({ rutaDenue: path.join(tmpdir(), 'no_existe.csv') });
    await expect(correrMvp2(c2, true, true)).rejects.toThrow(/no_existe/);
    const c = await conn.one("SELECT estado, error FROM cargas_datos WHERE fuente_clave='inegi_denue'");
    expect(c.estado).toBe('error');
    expect(c.error).toContain('no_existe');
    expect((await conn.one("SELECT estado FROM fuentes_datos WHERE clave='inegi_denue'")).estado).toBe('error');
  });

  si('el validador falla con menos de 30 zonas', async () => {
    await corrida();
    await conn.query('UPDATE colonias SET es_piloto=FALSE WHERE id IN (SELECT id FROM colonias WHERE es_piloto LIMIT 1)');
    const checks = Object.fromEntries((await validacion.ejecutar(conn, cfg())).map((c) => [c.id, c]));
    expect(checks.zonas_piloto.estado).toBe('fail');
  });

  si('modo real sin archivos da un error claro', async () => {
    const vacio = mkdtempSync(path.join(tmpdir(), 'civitas-raw-'));
    expect(() => resolverRutas(cfg({ modo: 'real', rawDir: vacio }))).toThrow(/data\/raw/);
    mkdirSync(path.join(vacio, 'mgn'));
  });

  si('ruta Shapefile con reproyección EPSG:6372 (ITRF2008/LCC) → 4326', async () => {
    await migrar(conn);
    // Verdad de terreno independiente: coordenadas y .prj de PostGIS/PROJ, no de la librería que se prueba.
    const anillo4326 = 'POLYGON((-98.21 19.04,-98.21 19.05,-98.20 19.05,-98.20 19.04,-98.21 19.04))'; // horario
    const g = await conn.one('SELECT ST_AsText(ST_Transform(ST_GeomFromText($1,4326),6372)) AS wkt, (SELECT srtext FROM spatial_ref_sys WHERE srid=6372) AS prj', [anillo4326]);
    const pares = (g.wkt as string).replace(/^POLYGON\(\(|\)\)$/g, '').split(',').map((p) => p.trim().split(' ').map(Number) as [number, number]);
    const dir = mkdtempSync(path.join(tmpdir(), 'civitas-shp-'));
    escribirShapefile(path.join(dir, '21a'), pares, { CVEGEO: '2111400010123', CVE_ENT: '21', CVE_MUN: '114' }, g.prj);
    const shp = path.join(dir, '21a.shp');

    const c2 = cfg({ modo: 'real', rutaZonas: shp });
    await conCarga(conn, 'inegi_mgn', 'real', shp, 'jest', null, async (c) => {
      await cargarZonas(conn, c2, c);
      expect(c.cargados).toBe(1);
    });
    const ext = await conn.one("SELECT ST_XMin(geom) AS x, ST_YMin(geom) AS y, ST_SRID(geom) AS s FROM colonias WHERE clave_geo='2111400010123'");
    expect(ext.s).toBe(4326);
    expect(Math.abs(Number(ext.x) + 98.21)).toBeLessThan(1e-4);
    expect(Math.abs(Number(ext.y) - 19.04)).toBeLessThan(1e-4);
  });

  si('los modos no se mezclan', async () => {
    await corrida();
    const carga = (await conn.one("INSERT INTO cargas_datos (fuente_clave, modo, estado) VALUES ('inegi_mgn','real','ok') RETURNING id")).id;
    await conn.query("INSERT INTO colonias (nombre, ciudad, geom, clave_geo, carga_id, es_piloto) VALUES " +
      "('real','Puebla', ST_Multi(ST_GeomFromText('POLYGON((-98 19,-97.9 19,-97.9 19.1,-98 19))',4326)), 'REAL1', $1, TRUE)", [carga]);
    const checks = Object.fromEntries((await validacion.ejecutar(conn, cfg())).map((c) => [c.id, c]));
    expect(checks.origen_unico.estado).toBe('fail'); // el validador lo detecta…
    expect(await correrMvp2(cfg())).toBe(true); // …y la siguiente corrida lo limpia
    expect(await n("SELECT count(*) AS n FROM colonias WHERE clave_geo='REAL1'")).toBe(0);
  });
});
