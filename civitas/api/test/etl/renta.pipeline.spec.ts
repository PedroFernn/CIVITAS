/** MVP-3 contra PostGIS: los criterios "Para pasar" ejecutados de verdad (MVP-2 desde cero + MVP-3 encima). */
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Config, FIXTURES, nuevaConfig } from '../../src/etl/config';
import { Conn, conectar } from '../../src/etl/db';
import { correrMvp2 } from '../../src/etl/pipeline';
import { correrMvp3 } from '../../src/etl/renta/pipeline';
import * as validacion3 from '../../src/etl/renta/validacion';
import { prepararBdPruebas, TEST_DB_URL } from '../helpers/db';

let hayBd = false;
let conn: Conn;
const cfg = (p: Partial<Config> = {}) => nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'jest', ...p });
const n = async (sql: string, ...p: unknown[]) => Number((await conn.one(sql, p)).n);
const tmp = () => mkdtempSync(path.join(tmpdir(), 'civitas-r3-'));
const FIXTURE_RENTA = path.join(FIXTURES, 'renta_fixture.csv');

beforeAll(async () => {
  hayBd = await prepararBdPruebas();
  if (hayBd) conn = await conectar(TEST_DB_URL);
});
afterAll(async () => { await conn?.close(); });

/** MVP-2 desde cero y MVP-3 encima (como `etl mvp2 --desde-cero` + `etl mvp3`). */
async function corrida(extra: Partial<Config> = {}) {
  expect(await correrMvp2(cfg(), true, true)).toBe(true);
  return correrMvp3(cfg(extra));
}
const checks = async (extra: Partial<Config> = {}) => Object.fromEntries((await validacion3.ejecutar(conn, cfg(extra))).map((c) => [c.id, c]));
const si = (nombre: string, fn: () => Promise<void>, ms = 90_000) => it(nombre, async () => { if (!hayBd) return; await fn(); }, ms);

describe('ETL MVP-3 (PostGIS)', () => {
  si('desde cero cumple "para pasar": ≥300 con zona, <10 % nulos, reporte y decisión', async () => {
    expect(await corrida()).toBe(true);
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE zona_id IS NOT NULL')).toBeGreaterThanOrEqual(300);
    const ultimo = await conn.one('SELECT aprobada, resultados FROM mvp3_validaciones ORDER BY id DESC LIMIT 1');
    expect(ultimo.aprobada).toBe(true);
    expect(ultimo.resultados.filter((c: any) => c.estado === 'fail')).toEqual([]);

    const rep = (await conn.one('SELECT resumen FROM reportes_calidad ORDER BY carga_id DESC LIMIT 1')).resumen;
    expect(rep.campos_clave.tasa_nulos).toBeGreaterThan(0);          // el fixture sí tiene huecos…
    expect(rep.campos_clave.tasa_nulos).toBeLessThan(0.1);           // …pero bajo el umbral
    expect(rep.resultado).toEqual({ cumple_min_listados: true, cumple_umbral_nulos: true });
    const c = await checks();
    expect(c.decision_fuente.estado).toBe('ok');
    expect(c.legalidad_terminos.estado).toBe('warn');                // la revisión de términos queda pendiente (la hace una persona)
    expect(c.datos_reales.estado).toBe('warn');
  });

  si('normaliza: precio, m², recámaras y coordenadas válidos en BD', async () => {
    await corrida();
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE precio_mxn < 1000 OR precio_mxn > 250000')).toBe(0);
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE superficie_m2 IS NOT NULL AND (superficie_m2 < 8 OR superficie_m2 > 1500)')).toBe(0);
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE ST_SRID(geom) <> 4326 OR NOT ST_IsValid(geom)')).toBe(0);
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE recamaras = 0')).toBeGreaterThan(0);   // "estudio" → 0
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE url LIKE \'%?%\' OR url LIKE \'%#%\'')).toBe(0);
    // columna generada: precio por m²
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE superficie_m2 IS NOT NULL AND precio_m2 <> ROUND(precio_mxn / superficie_m2, 2)')).toBe(0);
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE superficie_m2 IS NULL AND precio_m2 IS NOT NULL')).toBe(0);
  });

  si('zona asignada: coincide con una consulta espacial independiente y hay listados sin zona', async () => {
    await corrida();
    expect(await n(`SELECT count(*) AS n FROM listados_renta l
      WHERE l.zona_id IS DISTINCT FROM (SELECT z.id FROM colonias z WHERE ST_Covers(z.geom, l.geom) ORDER BY z.id LIMIT 1)`)).toBe(0);
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE zona_id IS NULL')).toBeGreaterThanOrEqual(1);
  });

  si('descartes registrados con su motivo (19 filas defectuosas del fixture)', async () => {
    await corrida();
    const c = await conn.one("SELECT * FROM cargas_datos WHERE fuente_clave='renta_captura_manual' ORDER BY id DESC LIMIT 1");
    expect(c.registros_descartados).toBe(19);
    expect(c.registros_cargados).toBe(c.registros_leidos - 19);
    const motivos = new Set((await conn.query('SELECT motivo FROM cargas_descartes WHERE carga_id=$1', [c.id])).map((r) => r.motivo.split(' (')[0]));
    for (const m of ['precio faltante', 'precio no numérico', 'moneda no soportada', 'precio fuera de rango', 'sin coordenadas',
      'coordenadas no numéricas', 'coordenadas fuera de México', 'sin id de anuncio', 'id duplicado en el archivo', 'republicación duplicada']) {
      expect(motivos).toContain(m);
    }
    const rep = (await conn.one('SELECT resumen FROM reportes_calidad WHERE carga_id=$1', [c.id])).resumen;
    expect(Object.values(rep.descartes_por_motivo).reduce((a: number, b) => a + (b as number), 0)).toBe(19);
    expect(rep.totales.republicaciones_descartadas).toBe(3);
  });

  si('deduplicación: sin ids ni huellas repetidos y una republicación en BD no entra', async () => {
    await corrida();
    expect(await n('SELECT count(*) AS n FROM (SELECT 1 FROM listados_renta GROUP BY fuente_clave, id_fuente HAVING count(*)>1) x')).toBe(0);
    expect(await n('SELECT count(*) AS n FROM (SELECT 1 FROM listados_renta WHERE huella IS NOT NULL GROUP BY fuente_clave, huella HAVING count(*)>1) x')).toBe(0);
    // La BD lo impone también: insertar la misma huella con otro id falla (violación de unicidad)
    const o = await conn.one('SELECT * FROM listados_renta WHERE huella IS NOT NULL LIMIT 1');
    await expect(conn.query(
      `INSERT INTO listados_renta (fuente_clave, id_fuente, precio_mxn, geom, huella, carga_id)
       VALUES ($1, 'otro-id', 5000, ST_SetSRID(ST_MakePoint(-98.2, 19.04), 4326), $2, $3)`, [o.fuente_clave, o.huella, o.carga_id])).rejects.toMatchObject({ code: '23505' });
  });

  si('republicación entre cargas: mismo contenido con otro id en un segundo archivo se descarta', async () => {
    await corrida();
    const antes = await n('SELECT count(*) AS n FROM listados_renta');
    const original = await conn.one(`SELECT id_fuente, tipo_inmueble, precio_mxn::float AS p, superficie_m2::float AS s, recamaras AS r,
      ST_Y(geom) AS lat, ST_X(geom) AS lon FROM listados_renta WHERE huella IS NOT NULL AND recamaras IS NOT NULL ORDER BY id LIMIT 1`);
    const f = path.join(tmp(), 'segundo.csv');
    writeFileSync(f, ['id_anuncio,tipo,precio,superficie_m2,recamaras,latitud,longitud',
      `NUEVO-1,${original.tipo_inmueble},${original.p},${original.s},${original.r},${original.lat},${original.lon}`,
      'NUEVO-2,casa,7000,80,2,19.0400,-98.2100'].join('\n') + '\n', 'utf8');
    expect(await correrMvp3(cfg({ rutaListados: f }))).toBeDefined();
    const c = await conn.one("SELECT * FROM cargas_datos WHERE fuente_clave='renta_captura_manual' ORDER BY id DESC LIMIT 1");
    expect(c.registros_descartados).toBe(1);
    const d = await conn.one('SELECT motivo FROM cargas_descartes WHERE carga_id=$1', [c.id]);
    expect(d.motivo).toContain(`id=${original.id_fuente}`);
    expect(await n('SELECT count(*) AS n FROM listados_renta')).toBe(antes + 1);
  });

  si('privacidad: sin columnas personales; un archivo con teléfono/anunciante no deja rastro en la BD', async () => {
    await corrida();
    expect(await n(`SELECT count(*) AS n FROM information_schema.columns WHERE table_name='listados_renta'
      AND column_name ~* '(tel|cel|whats|phone|contact|anunciante|vendedor|agente|correo|mail|nombre|descrip)'`)).toBe(0);
    const f = path.join(tmp(), 'con_pii.csv');
    writeFileSync(f, ['id_anuncio,url,tipo,precio,superficie_m2,recamaras,latitud,longitud,telefono,nombre_anunciante,descripcion',
      'PII-1,https://x.invalid/a?tel=2229998877,casa,9000,90,3,19.0400,-98.2100,2229998877,María Secreta,Llame al 2229998877'].join('\n') + '\n', 'utf8');
    await correrMvp3(cfg({ rutaListados: f }));
    for (const t of ['listados_renta', 'cargas_datos', 'cargas_descartes', 'reportes_calidad', 'mvp3_validaciones']) {
      expect(await n(`SELECT count(*) AS n FROM ${t} x WHERE x::text LIKE '%2229998877%' OR x::text LIKE '%María Secreta%'`)).toBe(0);
    }
    expect(await n("SELECT count(*) AS n FROM listados_renta WHERE id_fuente='PII-1' AND url = 'https://x.invalid/a'")).toBe(1);
    const rep = (await conn.one('SELECT resumen FROM reportes_calidad ORDER BY carga_id DESC LIMIT 1')).resumen;
    expect(rep.columnas_sensibles_ignoradas).toEqual(['telefono', 'nombre_anunciante', 'descripcion']);
    expect((await checks()).privacidad.estado).toBe('warn');          // la BD está limpia, pero el archivo de origen trae datos personales
  });

  si('idempotente: una segunda corrida no duplica y cada carga deja su rastro', async () => {
    await corrida();
    const [antes, nZona] = [await n('SELECT count(*) AS n FROM listados_renta'), await n('SELECT count(zona_id) AS n FROM listados_renta')];
    expect(await correrMvp3(cfg())).toBe(true);
    expect(await n('SELECT count(*) AS n FROM listados_renta')).toBe(antes);
    expect(await n('SELECT count(zona_id) AS n FROM listados_renta')).toBe(nZona);
    expect(await n("SELECT count(*) AS n FROM cargas_datos WHERE fuente_clave='renta_captura_manual'")).toBe(2);
    expect(await n('SELECT count(*) AS n FROM reportes_calidad')).toBe(2);
  });

  si('trazabilidad: fuente, archivo, hash y comando de la carga', async () => {
    await corrida();
    const c = await conn.one("SELECT * FROM cargas_datos WHERE fuente_clave='renta_captura_manual' ORDER BY id DESC LIMIT 1");
    expect(c.estado).toBe('ok');
    expect(c.sha256).toHaveLength(64);
    expect(c.archivo_origen).toContain('renta_fixture.csv');
    expect(await n('SELECT count(*) AS n FROM listados_renta WHERE carga_id IS NULL')).toBe(0);
    expect(await n("SELECT count(*) AS n FROM fuentes_datos WHERE clave='renta_captura_manual' AND ultima_ingesta IS NOT NULL")).toBe(1);
  });

  si('sin zonas de MVP-2 da un error claro', async () => {
    expect(await correrMvp2(cfg(), true, true)).toBe(true);
    await conn.query('DELETE FROM colonias');
    await expect(correrMvp3(cfg())).rejects.toThrow(/^MVP-3: no hay zonas cargadas/);
  });

  si('una importación fallida queda registrada como error', async () => {
    expect(await correrMvp2(cfg(), true, true)).toBe(true);
    await expect(correrMvp3(cfg({ rutaListados: path.join(tmpdir(), 'no_existe_renta.csv') }))).rejects.toThrow(/no_existe_renta/);
    const c = await conn.one("SELECT estado, error FROM cargas_datos WHERE fuente_clave='renta_captura_manual'");
    expect(c.estado).toBe('error');
    expect((await conn.one("SELECT estado FROM fuentes_datos WHERE clave='renta_captura_manual'")).estado).toBe('error');
  });

  si('el umbral de nulos y el mínimo de listados son exigentes de verdad', async () => {
    expect(await corrida({ umbralNulos: 0.01 })).toBe(false);
    expect((await checks({ umbralNulos: 0.01 })).campos_clave_nulos.estado).toBe('fail');
    expect(await correrMvp3(cfg({ minListados: 5000 }))).toBe(false);
    expect((await checks({ minListados: 5000 })).listados_con_zona.estado).toBe('fail');
  });

  si('sin ADR-002 o con términos que NO permiten el uso, el validador lo marca', async () => {
    await corrida();
    expect((await checks({ adrRenta: path.join(tmp(), 'no-hay.md') })).decision_fuente.estado).toBe('fail');
    const adr = path.join(tmp(), 'adr.md');
    writeFileSync(adr, ['---', 'estado: aceptada', 'decision: captura_manual', 'portal: P', 'terminos_url: https://p.mx/t',
      'terminos_revisados_en: 2026-10-16', 'terminos_revisados_por: Ana', 'terminos_permiten_uso: no', '---'].join('\n'));
    const c = await checks({ adrRenta: adr });
    expect(c.decision_fuente.estado).toBe('ok');
    expect(c.legalidad_terminos.estado).toBe('warn');                 // sintético: aviso; con datos reales sería fallo
    expect(c.legalidad_terminos.detalle).toContain('NO permiten');
  });

  si('con datos reales exige ADR aceptado y revisión de términos; no se mezclan con las zonas sintéticas', async () => {
    await corrida();
    const copia = path.join(tmp(), 'real.csv');
    copyFileSync(FIXTURE_RENTA, copia);
    // Cargados como "real" sobre zonas sintéticas: debe fallar el origen, la decisión (ADR no aceptado) y la legalidad
    expect(await correrMvp3(cfg({ modo: 'real', rutaListados: copia }))).toBe(false);
    const c = await checks();
    expect(c.origen_unico.estado).toBe('fail');
    expect(c.decision_fuente.estado).toBe('fail');
    expect(c.legalidad_terminos.estado).toBe('fail');
    expect(c.datos_reales).toBeUndefined();
    // La siguiente corrida sintética limpia lo "real" y vuelve a aprobar
    expect(await correrMvp3(cfg())).toBe(true);
    expect(await n("SELECT count(*) AS n FROM listados_renta l JOIN cargas_datos cd ON cd.id=l.carga_id WHERE cd.modo='real'")).toBe(0);
  });

  si('la BD rechaza datos inválidos (restricciones CHECK)', async () => {
    await corrida();
    const ins = (cols: string, vals: string) => conn.query(
      `INSERT INTO listados_renta (fuente_clave, id_fuente, geom, carga_id, ${cols}) SELECT 'renta_captura_manual', 'x-'||random(), ST_SetSRID(ST_MakePoint(-98.2,19.04),4326), max(id), ${vals} FROM cargas_datos`);
    await expect(ins('precio_mxn', '-5')).rejects.toMatchObject({ code: '23514' });
    await expect(ins('precio_mxn, recamaras', '5000, 99')).rejects.toMatchObject({ code: '23514' });
    await expect(ins('precio_mxn, superficie_m2', '5000, 0')).rejects.toMatchObject({ code: '23514' });
    await expect(ins('precio_mxn, tipo_inmueble', "5000, 'castillo'")).rejects.toMatchObject({ code: '23514' });
  });
});
