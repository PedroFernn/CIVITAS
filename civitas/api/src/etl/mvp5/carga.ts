/** Prueba de carga de MVP-5 (RNF Rendimiento): N usuarios simulados en paralelo, sin tiempo de espera entre acciones (peor caso). */

export interface ResultadoCarga {
  usuarios: number;
  solicitudes: number;
  errores: number;
  duracion_ms: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  solicitudes_por_s: number;
  primer_error?: string;
}

/** Percentil «por rango más cercano» sobre una lista (0 si está vacía). */
export const percentil = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * p) - 1)] ?? 0;

export type Medir = <T>(accion: () => Promise<T>) => Promise<T | undefined>;

/**
 * Lanza `usuarios` sesiones a la vez. Cada acción pasa por `medir`, que registra su duración y cuenta los errores
 * sin detener a los demás (una sesión que falla en una acción sigue con la siguiente).
 */
export async function simularUsuarios(usuarios: number, sesion: (i: number, medir: Medir) => Promise<void>): Promise<ResultadoCarga> {
  const tiempos: number[] = [];
  let errores = 0;
  let primerError: string | undefined;
  const medir: Medir = async (accion) => {
    const t0 = performance.now();
    try {
      return await accion();
    } catch (e) {
      errores++;
      primerError ??= (e as Error).message;
      return undefined;
    } finally {
      tiempos.push(performance.now() - t0);
    }
  };
  const t0 = performance.now();
  await Promise.all(Array.from({ length: usuarios }, (_, i) => sesion(i, medir)));
  const duracion = performance.now() - t0;
  return {
    usuarios,
    solicitudes: tiempos.length,
    errores,
    duracion_ms: Math.round(duracion),
    p50_ms: Math.round(percentil(tiempos, 0.5)),
    p95_ms: Math.round(percentil(tiempos, 0.95)),
    max_ms: Math.round(Math.max(0, ...tiempos)),
    solicitudes_por_s: duracion > 0 ? Math.round((tiempos.length / duracion) * 1000) : 0,
    primer_error: primerError,
  };
}
