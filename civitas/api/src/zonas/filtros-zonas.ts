import { BadRequestException } from '@nestjs/common';
import { entero } from '../colonias/filtros';
import { MAX_Q, terminos } from './busqueda';

export const ORDENES_ZONAS = ['relevancia', 'nombre', 'renta', 'precio_m2', 'comercios', 'paradas', 'listados'] as const;
export type OrdenZonas = (typeof ORDENES_ZONAS)[number];

export interface FiltrosZonas {
  q: string[];                 // términos normalizados
  ciudad?: string;
  piloto: boolean;
  minRenta?: number;
  maxRenta?: number;
  conPrecio: boolean;          // solo zonas con estadística publicable (≥ MIN_LISTADOS_ESTADISTICA)
  orden: OrdenZonas;
  limit: number;
  offset: number;
}

type Q = Record<string, string | undefined>;

/** Valida y normaliza los query params de GET /zonas y /zonas/geojson. Todo lo que llega a SQL va parametrizado. */
export function parseFiltrosZonas(q: Q, limitMax = 200, limitPorDefecto = 12): FiltrosZonas {
  if (q.q !== undefined && q.q.length > MAX_Q * 2) throw new BadRequestException(`q admite hasta ${MAX_Q} caracteres`);
  const terms = terminos(q.q);
  const orden = (q.orden ?? (terms.length ? 'relevancia' : 'nombre')) as OrdenZonas;
  if (orden === 'relevancia' && !terms.length) throw new BadRequestException('orden=relevancia requiere q');
  if (!(ORDENES_ZONAS as readonly string[]).includes(orden)) throw new BadRequestException(`orden debe ser ${ORDENES_ZONAS.join('|')}`);
  if (q.piloto !== undefined && !['true', 'false'].includes(q.piloto)) throw new BadRequestException('piloto debe ser true|false');
  if (q.con_precio !== undefined && !['true', 'false'].includes(q.con_precio)) throw new BadRequestException('con_precio debe ser true|false');
  const minRenta = entero(q.min_renta, 'min_renta', 0, 100_000_000);
  const maxRenta = entero(q.max_renta, 'max_renta', 0, 100_000_000);
  if (minRenta !== undefined && maxRenta !== undefined && minRenta > maxRenta) throw new BadRequestException('min_renta no puede ser mayor que max_renta');
  return {
    q: terms,
    ciudad: q.ciudad?.trim() || undefined,
    piloto: q.piloto !== 'false',
    minRenta,
    maxRenta,
    conPrecio: q.con_precio === 'true' || minRenta !== undefined || maxRenta !== undefined,
    orden,
    limit: entero(q.limit, 'limit', 1, limitMax) ?? Math.min(limitPorDefecto, limitMax),
    offset: entero(q.offset, 'offset', 0, 1_000_000) ?? 0,
  };
}
