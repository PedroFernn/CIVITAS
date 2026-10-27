export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export interface Zona {
  id: string; nombre: string; ciudad: string; tipo_unidad: string; clave_geo: string; estado: string;
  area_km2: number | null; num_comercios: number; num_comercios_mayoreo: number; num_comercios_menudeo: number;
  num_unidades_economicas: number; num_paradas: number; densidad_comercios_km2: number | null; densidad_paradas_km2: number | null;
  fuente_geom: string; modo_datos: 'real' | 'fixture'; fecha_carga: string;
}
export interface ListaZonas { total: number; items: Zona[] }
export interface FeatureZona { type: 'Feature'; id: string; properties: Zona; geometry: { type: string; coordinates: any } }
export interface Fuente {
  clave: string; nombre: string; estado: string; ultima_ingesta: string | null; modo: string | null;
  registros_cargados: number | null; registros_descartados: number | null; url: string | null;
}
export interface Check { id: string; requisito: string; descripcion: string; estado: 'ok' | 'fail' | 'warn'; detalle: string }
export interface Validacion { ejecutada_en: string; aprobada: boolean; modo: string; resultados: Check[] }

// ── MVP-3 · precios de renta ──
export interface ListadoRenta {
  id: string; id_fuente: string; tipo_inmueble: string; precio_mxn: number; superficie_m2: number | null; recamaras: number | null;
  precio_m2: number | null; publicado_en: string | null; zona_id: string | null; zona_nombre: string | null; modo_datos: 'real' | 'fixture';
}
export interface ListaListados { total: number; items: ListadoRenta[] }
export interface ZonaRenta {
  zona_id: string; nombre: string; clave_geo: string; es_piloto: boolean; n_listados: number; estadistica_suprimida: boolean;
  renta_mediana: number | null; renta_p25: number | null; renta_p75: number | null; precio_m2_mediano: number | null;
}
export interface ResumenZonasRenta { total: number; min_listados_estadistica: number; items: ZonaRenta[] }
export interface Distribucion { n: number; min: number; p25: number; mediana: number; p75: number; max: number }
export interface ReporteCalidad {
  generado_en: string; modo: 'real' | 'fixture'; carga_id: number; archivo_origen: string | null;
  umbrales: { min_listados_con_zona: number; max_tasa_nulos: number };
  totales: { leidos: number; cargados: number; descartados: number; republicaciones_descartadas: number; con_zona: number; sin_zona: number;
    en_zonas_piloto: number; acumulado: { listados: number; con_zona: number } };
  campos_clave: { evaluados: number; con_algun_nulo: number; tasa_nulos: number;
    por_campo: Record<'precio' | 'superficie_m2' | 'recamaras' | 'coordenadas', { nulos: number; tasa: number; motivos: Record<string, number> }> };
  descartes_por_motivo: Record<string, number>;
  columnas_sensibles_ignoradas: string[];
  distribucion: { precio_mxn: Distribucion | null; precio_m2: Distribucion | null; por_tipo: Record<string, number> };
  zonas: { con_listados: number; piloto_con_listados: number; total_piloto: number };
}

export async function api<T>(path: string, token?: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export const fechaMX = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const num = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (x: number, d = 1) => `${(x * 100).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
export const mxn = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }));
