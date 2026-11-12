/**
 * Motor de anomalías v1 (MVP-6 · H6): ¿el precio por m² de un listado es justo, inflado o de subprecio frente a sus comparables?
 *
 * Método (plan Scrum, MVP-6: mediana y MAD del precio por m² por zona y recámaras; z robusto con umbral calibrado), con una corrección
 * que salió de medir la primera versión (precisión de 46 % contra la muestra): comparar listados de tipos y recámaras distintos
 * dentro del mismo grupo, o contra todo un municipio, mezcla diferencias NORMALES con anomalías. Por eso:
 *   1. Se quita el efecto del tipo de inmueble y de las recámaras: cada precio por m² se divide entre el factor de su tipo y recámaras
 *      (mediana de ese tipo/recámaras en todo el estado entre la mediana de todos).
 *   2. Se trabaja en escala logarítmica (los precios cambian por proporción, no por diferencia): la «zona cara» y la «zona barata» pesan igual.
 *   3. Se compara con los demás listados de la MISMA zona (mínimo 5); si no alcanza, el municipio y luego el estado.
 *   4. z robusto = (ln x − mediana) / σ, con σ = 1.4826 · MAD y un piso de 0.08 (≈ 8 % de variación natural).
 * z > umbral → «inflado»; z < −umbral → «subprecio»; en medio → «justo». Todo es función pura: se prueba sin base de datos.
 */

export type Etiqueta = 'justo' | 'inflado' | 'subprecio';
export type Nivel = 'zona' | 'municipio' | 'estado';

export interface ListadoEntrada {
  id: number;
  zonaId: string | null;
  cveMun: string | null;
  tipo: string;
  recamaras: number | null;
  precioM2: number;
}
export interface Veredicto {
  id: number;
  etiqueta: Etiqueta;
  z: number;
  nivel: Nivel;
  medianaM2: number;
  nGrupo: number;
}

/** Tamaño mínimo de grupo para comparar en cada nivel (con menos, la mediana y el MAD no son fiables). */
export const MIN_GRUPO: Record<Nivel, number> = { zona: 5, municipio: 8, estado: 8 };
export const UMBRAL_POR_DEFECTO = 2.5;
export const GRILLA_UMBRAL = [1.5, 2, 2.5, 3, 3.5, 4, 5];
export const PISO_SIGMA = 0.08; // en escala logarítmica ≈ 8 % de variación natural entre listados comparables
/** Precisión que debe cumplir el umbral calibrado (criterio del plan para MVP-7); una falsa acusación de «inflado» cuesta más que una omisión. */
export const PRECISION_OBJETIVO = 0.85;

export function mediana(xs: number[]): number {
  if (!xs.length) return NaN;
  const o = [...xs].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** σ robusta = 1.4826 · MAD, con un piso para que un grupo casi idéntico no dispare falsos positivos. Recibe valores ya en escala logarítmica. */
export function sigmaRobusta(xs: number[], med: number): number {
  const mad = mediana(xs.map((x) => Math.abs(x - med)));
  return Math.max(1.4826 * mad, PISO_SIGMA);
}

const cubeta = (r: number | null) => (r === null ? -1 : Math.min(4, Math.max(0, r)));

/** Factor multiplicativo de cada tipo y recámaras (mediana del grupo en todo el estado entre la mediana global; 1 si el grupo es chico). */
export function factoresTipoRecamaras(ls: ListadoEntrada[]): { factor: (l: ListadoEntrada) => number } {
  const porTR = new Map<string, number[]>();
  for (const l of ls) { const k = `${l.tipo}|${cubeta(l.recamaras)}`; (porTR.get(k) ?? porTR.set(k, []).get(k)!).push(l.precioM2); }
  const global = mediana(ls.map((l) => l.precioM2));
  const f = new Map<string, number>();
  for (const [k, xs] of porTR) f.set(k, xs.length >= MIN_GRUPO.estado && global > 0 ? mediana(xs) / global : 1);
  return { factor: (l) => f.get(`${l.tipo}|${cubeta(l.recamaras)}`) ?? 1 };
}

/** Etiqueta cada listado comparándolo con su grupo más local que tenga suficientes datos. */
export function clasificar(ls: ListadoEntrada[], umbral = UMBRAL_POR_DEFECTO): Veredicto[] {
  const { factor } = factoresTipoRecamaras(ls);
  const ajustados = ls.map((l) => { const fa = factor(l); return { l, fa, lx: Math.log(l.precioM2 / fa) }; });
  const porZona = new Map<string, number[]>(), porMun = new Map<string, number[]>(), estado: number[] = [];
  const meter = (m: Map<string, number[]>, k: string | null, v: number) => { if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(v); };
  for (const { l, lx } of ajustados) { meter(porZona, l.zonaId, lx); meter(porMun, l.cveMun, lx); estado.push(lx); }

  const out: Veredicto[] = [];
  for (const { l, fa, lx } of ajustados) {
    const grupo = ([
      ['zona', l.zonaId ? porZona.get(l.zonaId) : undefined],
      ['municipio', l.cveMun ? porMun.get(l.cveMun) : undefined],
      ['estado', estado],
    ] as const).map(([nivel, xs]) => ({ nivel: nivel as Nivel, xs })).find((g) => g.xs && g.xs.length >= MIN_GRUPO[g.nivel]);
    if (!grupo || !grupo.xs) continue; // sin grupo comparable: no se etiqueta (mejor callar que adivinar)
    const med = mediana(grupo.xs), sigma = sigmaRobusta(grupo.xs, med);
    const z = (lx - med) / sigma;
    out.push({ id: l.id, etiqueta: z > umbral ? 'inflado' : z < -umbral ? 'subprecio' : 'justo', z: Math.round(z * 1000) / 1000, nivel: grupo.nivel,
      medianaM2: Math.round(Math.exp(med) * fa * 100) / 100, nGrupo: grupo.xs.length });
  }
  return out;
}

export interface Metricas {
  evaluados: number;       // listados con veredicto y con etiqueta de referencia
  anomalosReales: number;  // etiquetados inflado o subprecio en la referencia
  anomalosDetectados: number;
  aciertos: number;        // detectados con la MISMA etiqueta que la referencia
  precision: number;       // aciertos / detectados
  recall: number;          // aciertos / anómalos reales
  f1: number;
  exactitud: number;       // coincidencia de etiqueta en los tres estados
  precisionIC: [number, number]; // Wilson 95 %
}

/** Intervalo de Wilson al 95 % para una proporción k/n. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function evaluar(veredictos: Veredicto[], referencia: Map<number, Etiqueta>): Metricas {
  let evaluados = 0, reales = 0, detectados = 0, aciertos = 0, iguales = 0;
  for (const v of veredictos) {
    const ref = referencia.get(v.id);
    if (!ref) continue;
    evaluados++;
    if (ref !== 'justo') reales++;
    if (v.etiqueta !== 'justo') detectados++;
    if (v.etiqueta !== 'justo' && v.etiqueta === ref) aciertos++;
    if (v.etiqueta === ref) iguales++;
  }
  const precision = detectados ? aciertos / detectados : 0, recall = reales ? aciertos / reales : 0;
  return {
    evaluados, anomalosReales: reales, anomalosDetectados: detectados, aciertos, precision, recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    exactitud: evaluados ? iguales / evaluados : 0,
    precisionIC: wilson(aciertos, detectados),
  };
}

/**
 * Elige el umbral de la grilla: el MÁS BAJO (el que más anomalías atrapa) cuya precisión alcance la meta; si ninguno la alcanza,
 * el de mayor F1 (en empate, el más alto). Una falsa acusación de «inflado» cuesta más que una omisión, por eso manda la precisión.
 */
export function calibrar(ls: ListadoEntrada[], referencia: Map<number, Etiqueta>, grilla = GRILLA_UMBRAL, objetivo = PRECISION_OBJETIVO): { umbral: number; tabla: { umbral: number; m: Metricas }[]; criterio: 'precision' | 'f1' } {
  const tabla = grilla.map((umbral) => ({ umbral, m: evaluar(clasificar(ls, umbral), referencia) }));
  const cumplen = tabla.filter((t) => t.m.anomalosDetectados > 0 && t.m.precision >= objetivo);
  if (cumplen.length) return { umbral: cumplen.reduce((a, b) => (b.umbral < a.umbral ? b : a)).umbral, tabla, criterio: 'precision' };
  const mejor = tabla.reduce((a, b) => (b.m.f1 > a.m.f1 || (b.m.f1 === a.m.f1 && b.umbral > a.umbral) ? b : a));
  return { umbral: mejor.umbral, tabla, criterio: 'f1' };
}
