import { BadRequestException } from '@nestjs/common';
import { entero } from '../colonias/filtros';
import { TIPOS_INMUEBLE, TipoInmueble } from '../etl/renta/tipos';

/** Zonas con menos listados no publican estadísticas (mediana, cuartiles): con 1–4 anuncios son poco fiables y casi identifican la oferta. */
export const MIN_LISTADOS_ESTADISTICA = 5;

export interface FiltrosListados {
  zonaId?: string;
  conZona?: boolean;
  tipo?: TipoInmueble;
  recamaras?: number;
  minPrecio?: number;
  maxPrecio?: number;
  orden: 'reciente' | 'precio' | 'precio_m2';
  limit: number;
  offset: number;
}

type Q = Record<string, string | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida y normaliza los query params de GET /listados-renta. Todo lo que llega a SQL va parametrizado. */
export function parseFiltrosListados(q: Q): FiltrosListados {
  if (q.zona_id !== undefined && !UUID.test(q.zona_id)) throw new BadRequestException('zona_id debe ser un UUID');
  if (q.con_zona !== undefined && !['true', 'false'].includes(q.con_zona)) throw new BadRequestException('con_zona debe ser true|false');
  if (q.tipo !== undefined && !(TIPOS_INMUEBLE as readonly string[]).includes(q.tipo)) {
    throw new BadRequestException(`tipo debe ser ${TIPOS_INMUEBLE.join('|')}`);
  }
  const orden = (q.orden ?? 'reciente') as FiltrosListados['orden'];
  if (!['reciente', 'precio', 'precio_m2'].includes(orden)) throw new BadRequestException('orden debe ser reciente|precio|precio_m2');
  const minPrecio = entero(q.min_precio, 'min_precio', 0, 100_000_000);
  const maxPrecio = entero(q.max_precio, 'max_precio', 0, 100_000_000);
  if (minPrecio !== undefined && maxPrecio !== undefined && minPrecio > maxPrecio) throw new BadRequestException('min_precio no puede ser mayor que max_precio');
  return {
    zonaId: q.zona_id,
    conZona: q.con_zona === undefined ? undefined : q.con_zona === 'true',
    tipo: q.tipo as TipoInmueble | undefined,
    recamaras: entero(q.recamaras, 'recamaras', 0, 10),
    minPrecio,
    maxPrecio,
    orden,
    limit: entero(q.limit, 'limit', 1, 200) ?? 50,
    offset: entero(q.offset, 'offset', 0, 1_000_000) ?? 0,
  };
}
