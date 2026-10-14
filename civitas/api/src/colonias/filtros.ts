import { BadRequestException } from '@nestjs/common';

export interface FiltrosColonias {
  ciudad?: string;
  piloto: boolean;
  minComercios?: number;
  minParadas?: number;
  bbox?: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
  orden: 'nombre' | 'comercios' | 'paradas';
  limit: number;
  offset: number;
}

type Q = Record<string, string | undefined>;

const entero = (v: string | undefined, nombre: string, min: number, max: number): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${nombre} debe ser entero entre ${min} y ${max}`);
  return n;
};

/** Valida y normaliza los query params de GET /colonias. Todo lo que llega a SQL va parametrizado. */
export function parseFiltros(q: Q, limitMax = 200): FiltrosColonias {
  let bbox: FiltrosColonias['bbox'];
  if (q.bbox) {
    const p = q.bbox.split(',').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isFinite(n)) || p[0] >= p[2] || p[1] >= p[3] ||
        p[0] < -180 || p[2] > 180 || p[1] < -90 || p[3] > 90) {
      throw new BadRequestException('bbox debe ser minLon,minLat,maxLon,maxLat válidos');
    }
    bbox = p as [number, number, number, number];
  }
  const orden = (q.orden ?? 'nombre') as FiltrosColonias['orden'];
  if (!['nombre', 'comercios', 'paradas'].includes(orden)) throw new BadRequestException('orden debe ser nombre|comercios|paradas');
  if (q.piloto !== undefined && !['true', 'false'].includes(q.piloto)) throw new BadRequestException('piloto debe ser true|false');
  return {
    ciudad: q.ciudad?.trim() || undefined,
    piloto: q.piloto !== 'false',
    minComercios: entero(q.min_comercios, 'min_comercios', 0, 1_000_000),
    minParadas: entero(q.min_paradas, 'min_paradas', 0, 1_000_000),
    bbox,
    orden,
    limit: entero(q.limit, 'limit', 1, limitMax) ?? Math.min(50, limitMax),
    offset: entero(q.offset, 'offset', 0, 1_000_000) ?? 0,
  };
}
