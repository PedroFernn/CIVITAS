/** Catálogo de zonas (MVP-4): tipos y utilidades seguras para el navegador (no leen variables de entorno del servidor). */

/** Prefijo público de la API: Caddy la expone en /api (y next.config la reenvía en `pnpm dev:web`). */
export const API_PUBLICA = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

export interface ZonaCatalogo {
  id: string; nombre: string; ciudad: string; tipo_unidad: string; clave_geo: string | null; es_piloto: boolean;
  area_km2: number | null; num_comercios: number; num_comercios_mayoreo: number; num_comercios_menudeo: number;
  num_paradas: number; densidad_comercios_km2: number | null;
  n_listados: number; n_precio_m2: number; estadistica_suprimida: boolean;
  renta_mediana: number | null; renta_p25: number | null; renta_p75: number | null; precio_m2_mediano: number | null;
}
export interface ListaCatalogo { total: number; limit: number; offset: number; min_listados_estadistica: number; items: ZonaCatalogo[] }
export interface FeatureCatalogo { type: 'Feature'; id: string; properties: ZonaCatalogo; geometry: { type: string; coordinates: any } }
export interface GeoCatalogo { type: 'FeatureCollection'; min_listados_estadistica: number; features: FeatureCatalogo[] }
export interface RespuestaBusqueda { q: string; sugeridas: boolean; total: number; items: ZonaCatalogo[] }

export interface FichaZona extends ZonaCatalogo {
  cve_ent: string | null; cve_mun: string | null;
  geometry: { type: string; coordinates: any };
  renta: {
    n_listados: number; estadistica_suprimida: boolean; min_listados_estadistica: number;
    mediana: number | null; p25: number | null; p75: number | null; precio_m2_mediano: number | null;
    por_tipo: { tipo: string; n: number; renta_mediana: number | null; precio_m2_mediano: number | null }[];
    posicion_precio_m2: { lugar: number; de: number } | null;
  };
  ciudad_referencia: { ciudad: string; n_listados: number; zonas: number; renta_mediana: number | null; precio_m2_mediano: number | null } | null;
  trazabilidad: {
    fuente_geom: string | null; modo_datos: 'real' | 'fixture' | null; fecha_carga: string | null;
    precios_actualizados_en: string | null; ultima_recaptura_en: string | null;
  };
  listados_recientes: { id: string; tipo_inmueble: string; precio_mxn: number; superficie_m2: number | null; recamaras: number | null; precio_m2: number | null; publicado_en: string | null }[];
}

export type Metrica = 'precio_m2' | 'renta' | 'comercios' | 'paradas';
export const METRICAS: { clave: Metrica; etiqueta: string; unidad: string }[] = [
  { clave: 'precio_m2', etiqueta: 'Renta por m²', unidad: 'MXN/m²' },
  { clave: 'renta', etiqueta: 'Renta mediana', unidad: 'MXN/mes' },
  { clave: 'comercios', etiqueta: 'Comercios', unidad: 'comercios' },
  { clave: 'paradas', etiqueta: 'Paradas', unidad: 'paradas' },
];

/** Valor de la métrica para una zona; null = no publicable (estadística suprimida). */
export function valorMetrica(z: ZonaCatalogo, m: Metrica): number | null {
  switch (m) {
    case 'precio_m2': return z.precio_m2_mediano;
    case 'renta': return z.renta_mediana;
    case 'comercios': return z.num_comercios;
    case 'paradas': return z.num_paradas;
  }
}

export const ESCALA = ['#e8eef7', '#c5d5ec', '#9cb8de', '#6f95cb', '#3f6cae', '#1d4580', '#0f2a4a'];
export const COLOR_SIN_DATO = '#d9dee6';

/** Color de un valor dentro de [min, max] (7 tonos). */
export function colorEscala(v: number | null, min: number, max: number): string {
  if (v === null) return COLOR_SIN_DATO;
  if (max <= min) return ESCALA[Math.floor(ESCALA.length / 2)];
  const t = (v - min) / (max - min);
  return ESCALA[Math.min(ESCALA.length - 1, Math.max(0, Math.floor(t * ESCALA.length)))];
}

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const terminos = (q: string) => normalizar(q).split(/\s+/).filter(Boolean).slice(0, 6);

export interface Trozo { t: string; m: boolean }

/** Parte `texto` en trozos marcando lo que coincide con algún término (sin distinguir acentos ni mayúsculas). */
export function resaltar(texto: string, ts: string[]): Trozo[] {
  const chars = [...texto];
  const norm = chars.map((c) => normalizar(c));
  const plano = norm.join('');
  const hacia: number[] = [];
  norm.forEach((n, i) => { for (let k = 0; k < n.length; k++) hacia.push(i); });
  const marca = new Array<boolean>(chars.length).fill(false);
  for (const t of ts) {
    if (!t) continue;
    for (let i = plano.indexOf(t); i !== -1; i = plano.indexOf(t, i + 1)) {
      for (let k = i; k < i + t.length; k++) marca[hacia[k]] = true;
    }
  }
  const out: Trozo[] = [];
  chars.forEach((c, i) => {
    const ult = out[out.length - 1];
    if (ult && ult.m === marca[i]) ult.t += c;
    else out.push({ t: c, m: marca[i] });
  });
  return out;
}

/** «1 parada», «2 paradas». */
export const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;

export const mxnC = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }));
export const mxn2 = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const entero = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-MX', { maximumFractionDigits: 0 }));
