/**
 * RF-1.3 (parcial) · Recaptura semanal de precios.
 * Con captura manual (ADR-002) «recapturar» es volver a ingerir, de forma idempotente, los archivos nuevos de data/raw/rentas
 * (en modo fixture, el CSV sintético: no cambia nada). No hay scraping: la persona sigue capturando; esto solo automatiza la ingesta.
 * RNF Disponibilidad: cada ejecución —y cada fallo— queda en cargas_datos (comando «recaptura»).
 */
import { Config } from '../config';
import { conectar } from '../db';
import { correrMvp3 } from '../renta/pipeline';

const DIA_MS = 86_400_000;
const MAX_ESPERA_MS = 2 ** 31 - 1; // límite de setTimeout (~24.8 días)

/** Anota el fallo en cargas_datos si la carga no llegó a hacerlo (p. ej. archivo ausente o zonas sin cargar). */
async function registrarFallo(cfg: Config, desde: Date, e: Error): Promise<void> {
  const conn = await conectar(cfg.databaseUrl);
  try {
    const ya = await conn.one(
      "SELECT count(*)::int AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error' AND iniciada_en >= $1", [desde]);
    if (ya.n > 0) return; // conCarga ya registró este fallo
    await conn.query(
      "INSERT INTO cargas_datos (fuente_clave, modo, estado, comando, finalizada_en, error) VALUES ($1,$2,'error',$3,now(),$4)",
      [cfg.fuenteRenta, cfg.modo, cfg.comando, `${e.name}: ${e.message}`.slice(0, 2000)]);
    await conn.query("UPDATE fuentes_datos SET estado = 'error' WHERE clave = $1", [cfg.fuenteRenta]);
  } finally {
    await conn.close();
  }
}

/** Una recaptura. Devuelve si el checklist de MVP-3 sigue aprobado; si algo falla, lo registra y relanza el error. */
export async function recapturar(cfg: Config, ingerir: (c: Config) => Promise<boolean> = correrMvp3): Promise<boolean> {
  const desde = new Date(Date.now() - 1000);
  try {
    return await ingerir(cfg);
  } catch (exc) {
    await registrarFallo(cfg, desde, exc as Error).catch((e2) => console.error(`No se pudo registrar el fallo: ${(e2 as Error).message}`));
    throw exc;
  }
}

/** Corre ahora y luego cada `cadaDias`. Un fallo se registra y NO detiene el programa: la siguiente semana vuelve a intentar. */
export async function programar(
  cfg: Config, cadaDias: number, señal?: AbortSignal,
  una: (c: Config) => Promise<boolean> = (c) => recapturar(c),
  esperar: (ms: number, s?: AbortSignal) => Promise<void> = dormir,
): Promise<void> {
  const ms = Math.min(MAX_ESPERA_MS, Math.round(cadaDias * DIA_MS));
  while (!señal?.aborted) {
    try {
      const ok = await una(cfg);
      console.log(`[recaptura] ${new Date().toISOString()} · ${ok ? 'ok' : 'checklist de MVP-3 NO aprobado'} · próxima en ${cadaDias} día(s)`);
    } catch (e) {
      console.error(`[recaptura] ${new Date().toISOString()} · FALLÓ: ${(e as Error).message} · se reintenta en ${cadaDias} día(s)`);
    }
    await esperar(ms, señal);
  }
}

function dormir(ms: number, señal?: AbortSignal): Promise<void> {
  return new Promise((res) => {
    const t = setTimeout(res, ms);
    señal?.addEventListener('abort', () => { clearTimeout(t); res(); }, { once: true });
  });
}
