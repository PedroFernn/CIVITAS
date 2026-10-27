/** MVP-4 · recaptura y checklist contra PostGIS: el cron registra sus ejecuciones y sus fallos (RNF Disponibilidad). */
import { Config, nuevaConfig } from '../../src/etl/config';
import { Conn, conectar } from '../../src/etl/db';
import { correrMvp2 } from '../../src/etl/pipeline';
import { correrMvp3 } from '../../src/etl/renta/pipeline';
import { programar, recapturar } from '../../src/etl/mvp4/recaptura';
import * as validacion4 from '../../src/etl/mvp4/validacion';
import { prepararBdPruebas, TEST_DB_URL } from '../helpers/db';

let hayBd = false;
let conn: Conn;
const cfg = (p: Partial<Config> = {}) => nuevaConfig({ databaseUrl: TEST_DB_URL, comando: 'civitas_etl recaptura', ...p });
const n = async (sql: string, ...p: unknown[]) => Number((await conn.one(sql, p)).n);
const si = (nombre: string, fn: () => Promise<void>, ms = 120_000) => it(nombre, async () => { if (!hayBd) return; await fn(); }, ms);

beforeAll(async () => {
  hayBd = await prepararBdPruebas();
  if (hayBd) {
    conn = await conectar(TEST_DB_URL);
    expect(await correrMvp2(cfg({ comando: 'jest' }), true, true)).toBe(true);
    expect(await correrMvp3(cfg({ comando: 'jest' }))).toBe(true);
  }
}, 180_000);
afterAll(async () => { await conn?.close(); });

describe('recaptura (PostGIS)', () => {
  si('re-ingerir el mismo archivo es idempotente y queda registrado', async () => {
    const antes = await n('SELECT count(*) AS n FROM listados_renta');
    expect(await recapturar(cfg())).toBe(true);
    expect(await n('SELECT count(*) AS n FROM listados_renta')).toBe(antes);
    expect(await n("SELECT count(*) AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'ok'")).toBeGreaterThanOrEqual(1);
  });

  si('un fallo antes de la carga (modo real sin archivo) se registra como error y se relanza', async () => {
    const antes = await n("SELECT count(*) AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error'");
    await expect(recapturar(cfg({ modo: 'real' }))).rejects.toThrow(/Modo real/);
    expect(await n("SELECT count(*) AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error'")).toBe(antes + 1);
    const f = await conn.one("SELECT error, finalizada_en FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error' ORDER BY id DESC LIMIT 1");
    expect(f.error).toMatch(/Modo real/);
    expect(f.finalizada_en).not.toBeNull();
    expect((await conn.one("SELECT estado FROM fuentes_datos WHERE clave = 'renta_captura_manual'")).estado).toBe('error');
  });

  si('un fallo dentro de la carga (archivo ilegible) queda registrado una sola vez', async () => {
    const antes = await n("SELECT count(*) AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error'");
    await expect(recapturar(cfg({ rutaListados: '/no/existe.csv' }))).rejects.toThrow();
    expect(await n("SELECT count(*) AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error'")).toBe(antes + 1);
  });

  si('el programador sobrevive a un fallo, repite y se detiene con la señal', async () => {
    const ctl = new AbortController();
    const intentos: string[] = [];
    let k = 0;
    const una = async () => { k++; intentos.push(k === 1 ? 'falla' : 'ok'); if (k === 1) throw new Error('portal caído'); return true; };
    const esperas: number[] = [];
    const esperar = async (ms: number) => { esperas.push(ms); if (k >= 3) ctl.abort(); };
    await programar(cfg(), 7, ctl.signal, una, esperar);
    expect(intentos).toEqual(['falla', 'ok', 'ok']);
    expect(esperas).toEqual([7 * 86_400_000, 7 * 86_400_000, 7 * 86_400_000]);
  });

  si('el checklist de MVP-4 aprueba con una recaptura programada y verifica 3 medianas a mano', async () => {
    await recapturar(cfg({ comando: 'civitas_etl recaptura --cada-dias 7 [programada]' }));
    const checks = Object.fromEntries((await validacion4.ejecutar(conn, cfg())).map((c) => [c.id, c]));
    expect(checks.mapa_y_ficha_30_zonas.estado).toBe('ok');
    expect(checks.mediana_m2_manual.estado).toBe('ok');
    expect(checks.mediana_m2_manual.detalle.match(/vs manual/g)).toHaveLength(3);
    expect(checks.recaptura_ejecutada.estado).toBe('ok');
    expect(checks.cron_registra_fallos.estado).toBe('ok');            // por los fallos de las pruebas anteriores
    expect(['ok', 'warn']).toContain(checks.latencia.estado);
    expect(checks.datos_reales.estado).toBe('warn');
    expect(await validacion4.guardar(conn, Object.values(checks), 'fixture')).toBe(true);
  });

  si('sin ninguna recaptura el checklist no aprueba', async () => {
    await conn.query("UPDATE cargas_datos SET comando = 'jest' WHERE comando LIKE '%recaptura%'");
    const checks = Object.fromEntries((await validacion4.ejecutar(conn, cfg())).map((c) => [c.id, c]));
    expect(checks.recaptura_ejecutada.estado).toBe('fail');
  });
});
