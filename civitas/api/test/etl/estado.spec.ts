/** MVP-6 · INEGI de todo el estado: varios municipios, población del Censo y consistencia, contra PostGIS. */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Config, FIXTURES, nuevaConfig } from '../../src/etl/config';
import { Conn, conectar } from '../../src/etl/db';
import { correrMvp2 } from '../../src/etl/pipeline';
import { calcularAnomalias } from '../../src/etl/mvp6/calcular';
import * as validacionMvp6 from '../../src/etl/mvp6/validacion';
import { prepararBdPruebas, TEST_DB_URL } from '../helpers/db';

let hayBd = false;
let conn: Conn;
const cfg = (p: Partial<Config> = {}) => nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest', ...p });
const n = async (sql: string, ...p: unknown[]) => Number((await conn.one(sql, p)).n);
const si = (nombre: string, fn: () => Promise<void>, ms = 90_000) => it(nombre, async () => { if (!hayBd) return; await fn(); }, ms);

beforeAll(async () => { hayBd = await prepararBdPruebas(); if (hayBd) conn = await conectar(TEST_DB_URL); });
afterAll(async () => { await conn?.close(); });

const NOMBRES: Record<string, string> = { '114': 'Puebla', '041': 'Cuautlancingo' };

/** El fixture de AGEB con lo que trae el servicio de INEGI: municipio oficial, localidad y población (una con «*» reservada). */
function archivos(pobMunicipio: Record<string, number> = { '114': 5_000_000, '041': 500_000 }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'civitas-estado-'));
  const gj = JSON.parse(readFileSync(path.join(FIXTURES, 'mgn_ageb_fixture.geojson'), 'utf8'));
  let primera = true;
  for (const f of gj.features) {
    const clave: string = f.properties.CVEGEO ?? f.properties.cvegeo ?? '';
    const mun = clave.slice(2, 5);
    Object.assign(f.properties, { nom_agem: NOMBRES[mun] ?? 'Otro', nom_loc: `Localidad ${mun}`, pobtot: primera ? '*' : '1200', tvivhab: primera ? '*' : '300' });
    primera = false;
  }
  const zonas = path.join(dir, 'zonas.geojson');
  writeFileSync(zonas, JSON.stringify(gj));
  const cajas = { type: 'FeatureCollection', features: Object.entries(NOMBRES).map(([cve, nombre]) => ({
    type: 'Feature', properties: { cvegeo: `21${cve}`, cve_agee: '21', cve_agem: cve, nom_agem: nombre, pob: String(pobMunicipio[cve]), viv: '1000' },
    geometry: { type: 'Polygon', coordinates: [[[-99, 18], [-96, 18], [-96, 20], [-99, 20], [-99, 18]]] } })) };
  const munis = path.join(dir, 'municipios.geojson');
  writeFileSync(munis, JSON.stringify(cajas));
  return { zonas, munis };
}
const sinResumen = () => calcularAnomalias(conn, {});

describe('ETL MVP-6 · INEGI de todo el estado', () => {
  si('con estadoCompleto carga los dos municipios, con su nombre oficial y la población del Censo', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    expect(await n("SELECT count(*) AS n FROM colonias WHERE clave_geo='21041FX0001'")).toBe(1);   // en modo capital se omite (ver pipeline.spec)
    expect(await n("SELECT count(*) AS n FROM colonias WHERE cve_mun='041' AND ciudad='Cuautlancingo'")).toBeGreaterThan(0);
    expect(await n("SELECT count(*) AS n FROM colonias WHERE cve_mun='114' AND ciudad='Puebla' AND localidad='Localidad 114'")).toBeGreaterThan(30);
    expect(await n('SELECT count(*) AS n FROM municipios')).toBe(2);
    // «*» del Censo (cifra reservada) es nulo, no cero; lo demás es entero
    expect(await n('SELECT count(*) AS n FROM colonias WHERE poblacion IS NULL')).toBe(1);
    expect(await n('SELECT count(*) AS n FROM colonias WHERE poblacion = 1200 AND viviendas = 300')).toBeGreaterThan(30);
    expect(await n("SELECT count(*) AS n FROM cargas_datos WHERE fuente_clave='inegi_mgem' AND estado='ok'")).toBe(1);
  });

  si('los pilotos siguen siendo solo del municipio del ADR-001, aunque haya zonas de otros', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    expect(await n('SELECT count(*) AS n FROM colonias WHERE es_piloto')).toBe(30);
    expect(await n("SELECT count(*) AS n FROM colonias WHERE es_piloto AND cve_mun <> '114'")).toBe(0);
  });

  si('sin estadoCompleto sigue cargando solo el municipio de los pilotos (comportamiento anterior)', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ rutaZonas: a.zonas }), true, true)).toBe(true);
    expect(await n("SELECT count(*) AS n FROM colonias WHERE cve_mun <> '114'")).toBe(0);
    expect(await n('SELECT count(*) AS n FROM municipios')).toBe(0);
  });

  si('el checklist de INEGI pasa con datos coherentes', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    const checks = new Map((await validacionMvp6.ejecutar(conn, cfg(), await sinResumen())).map((c) => [c.id, c]));
    for (const id of ['inegi_municipios', 'inegi_censo', 'inegi_cobertura']) expect([id, checks.get(id)!.estado]).toEqual([id, 'ok']);
    // las claves del fixture son inventadas (no miden 13 caracteres): con zonas sintéticas es aviso, nunca un falso «ok»
    expect(checks.get('inegi_claves')!.estado).toBe('warn');
    expect(checks.get('inegi_claves')!.detalle).toContain('sintéticas');
    expect(checks.get('inegi_cobertura')!.detalle).toContain('2 municipios');
  });

  si('con zonas de INEGI (modo real) una clave que no mide 13 caracteres SÍ falla', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    await conn.query("UPDATE cargas_datos SET modo = 'real' WHERE fuente_clave = 'inegi_mgn'"); // se hace pasar por una carga de INEGI
    const c = (await validacionMvp6.ejecutar(conn, cfg(), await sinResumen())).find((x) => x.id === 'inegi_claves')!;
    expect(c.estado).toBe('fail');
  });

  si('el checklist DETECTA una inconsistencia: un municipio con menos habitantes que la suma de sus AGEB', async () => {
    const a = archivos({ '114': 1_000, '041': 500_000 }); // imposible: las AGEB de Puebla suman decenas de miles
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    const c = (await validacionMvp6.ejecutar(conn, cfg(), await sinResumen())).find((x) => x.id === 'inegi_municipios')!;
    expect(c.estado).toBe('fail');
    expect(c.detalle).toContain('supera su población: 1');
  });

  si('el checklist DETECTA un nombre de municipio distinto al del catálogo', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    await conn.query("UPDATE municipios SET nombre = 'Puebla de Zaragoza' WHERE cve_mun = '114'");
    const c = (await validacionMvp6.ejecutar(conn, cfg(), await sinResumen())).find((x) => x.id === 'inegi_municipios')!;
    expect(c.estado).toBe('fail');
  });

  si('el motor de anomalías guarda un veredicto por listado y la API los puede unir', async () => {
    const a = archivos();
    expect(await correrMvp2(cfg({ estadoCompleto: true, rutaZonas: a.zonas, rutaMunicipios: a.munis }), true, true)).toBe(true);
    const { correrMvp3 } = await import('../../src/etl/renta/pipeline');
    expect(await correrMvp3(cfg())).toBe(true);
    const r = await calcularAnomalias(conn, {});
    expect(r.conSuperficie).toBeGreaterThan(0);
    expect(await n('SELECT count(*) AS n FROM listados_anomalias')).toBe(r.etiquetados);
    expect(r.calibrado).toBe(false); // sin muestra etiquetada se usa el umbral por defecto y se declara
    expect(r.etiquetasCoinciden).toBe(0);
    // recalcular es idempotente: no duplica
    await calcularAnomalias(conn, {});
    expect(await n('SELECT count(*) AS n FROM listados_anomalias')).toBe(r.etiquetados);
    expect(await n("SELECT count(*) AS n FROM listados_anomalias WHERE etiqueta NOT IN ('justo','inflado','subprecio')")).toBe(0);
  });
});
