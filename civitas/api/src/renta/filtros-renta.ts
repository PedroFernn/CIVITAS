import { BadRequestException } from '@nestjs/common';
import { entero } from '../colonias/filtros';
import { TIPOS_INMUEBLE, TipoInmueble } from '../etl/renta/tipos';
import { MAX_Q, terminos } from '../zonas/busqueda';

/** Zonas con menos listados no publican estadísticas (mediana, cuartiles): con 1–4 anuncios son poco fiables y casi identifican la oferta. */
export const MIN_LISTADOS_ESTADISTICA = 5;

/** reciente/antiguo: por fecha de publicación · precio/barato: renta más alta/baja · precio_m2: renta por m² · superficie y recamaras: de más a menos. */
export const ORDENES_LISTADOS = ['reciente', 'antiguo', 'precio', 'barato', 'precio_m2', 'superficie', 'recamaras'] as const;
export type OrdenListados = (typeof ORDENES_LISTADOS)[number];

export interface FiltrosListados {
  q: string[];                 // términos normalizados: zona, clave de zona, id del anuncio o tipo
  zonaId?: string;
  conZona?: boolean;
  tipo?: TipoInmueble;
  recamaras?: number;
  /** MVP-6: solo listados con esta etiqueta del motor de anomalías. */
  anomalia?: 'justo' | 'inflado' | 'subprecio';
  minPrecio?: number;
  maxPrecio?: number;
  orden: OrdenListados;
  limit: number;
  offset: number;
}

type Q = Record<string, string | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida y normaliza los query params de GET /listados-renta. Todo lo que llega a SQL va parametrizado. */
export function parseFiltrosListados(q: Q): FiltrosListados {
  if (q.q !== undefined && q.q.length > MAX_Q * 2) throw new BadRequestException(`q admite hasta ${MAX_Q} caracteres`);
  if (q.zona_id !== undefined && !UUID.test(q.zona_id)) throw new BadRequestException('zona_id debe ser un UUID');
  if (q.con_zona !== undefined && !['true', 'false'].includes(q.con_zona)) throw new BadRequestException('con_zona debe ser true|false');
  if (q.tipo !== undefined && !(TIPOS_INMUEBLE as readonly string[]).includes(q.tipo)) {
    throw new BadRequestException(`tipo debe ser ${TIPOS_INMUEBLE.join('|')}`);
  }
  if (q.anomalia !== undefined && !['justo', 'inflado', 'subprecio'].includes(q.anomalia)) throw new BadRequestException('anomalia debe ser justo|inflado|subprecio');
  const orden = (q.orden ?? 'reciente') as OrdenListados;
  if (!(ORDENES_LISTADOS as readonly string[]).includes(orden)) throw new BadRequestException(`orden debe ser ${ORDENES_LISTADOS.join('|')}`);
  const minPrecio = entero(q.min_precio, 'min_precio', 0, 100_000_000);
  const maxPrecio = entero(q.max_precio, 'max_precio', 0, 100_000_000);
  if (minPrecio !== undefined && maxPrecio !== undefined && minPrecio > maxPrecio) throw new BadRequestException('min_precio no puede ser mayor que max_precio');
  return {
    q: terminos(q.q),
    zonaId: q.zona_id,
    conZona: q.con_zona === undefined ? undefined : q.con_zona === 'true',
    tipo: q.tipo as TipoInmueble | undefined,
    recamaras: entero(q.recamaras, 'recamaras', 0, 10),
    anomalia: q.anomalia as FiltrosListados['anomalia'],
    minPrecio,
    maxPrecio,
    orden,
    limit: entero(q.limit, 'limit', 1, 200) ?? 50,
    offset: entero(q.offset, 'offset', 0, 1_000_000) ?? 0,
  };
}


