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

export async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export const fechaMX = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const num = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
