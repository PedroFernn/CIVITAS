import { BadRequestException } from '@nestjs/common';

/** RF-1.4: el comparador admite hasta 3 zonas (más deja de ser legible en móvil, P-07). */
export const MAX_COMPARAR = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `items=id1,id2,id3` → ids únicos en el orden pedido (1 a 3). Todo id debe ser un UUID: nada que no lo sea llega al SQL. */
export function parseIdsComparacion(items: string | string[] | undefined): string[] {
  const crudo = Array.isArray(items) ? items.join(',') : items ?? '';
  if (crudo.length > 200) throw new BadRequestException(`items admite hasta ${MAX_COMPARAR} ids de zona`);
  const ids: string[] = [];
  for (const t of crudo.split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!UUID.test(t)) throw new BadRequestException('items debe tener ids de zona (UUID) separados por coma');
    if (!ids.some((x) => x.toLowerCase() === t.toLowerCase())) ids.push(t);
  }
  if (!ids.length) throw new BadRequestException(`items es obligatorio: de 1 a ${MAX_COMPARAR} ids de zona separados por coma`);
  if (ids.length > MAX_COMPARAR) throw new BadRequestException(`Se pueden comparar hasta ${MAX_COMPARAR} zonas`);
  return ids;
}

/** Un municipio con menos zonas con precios que esto no sirve de referencia: se compara con todo el estado. */
export const MIN_ZONAS_REFERENCIA = 5;

export interface ReferenciaCiudad {
  ciudad: string; n_listados: number; zonas: number; renta_mediana: number | null; precio_m2_mediano: number | null;
}

const redondear = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Respuesta del comparador. Cada zona trae los mismos campos que el catálogo (`ZonaCatalogo`) más: su posición por precio por m²,
 * la diferencia porcentual de su renta mediana contra la ciudad y las paradas por km². Las zonas suprimidas no llevan diferencia.
 */
export function armarComparacion(filas: any[], ciudades: ReferenciaCiudad[], estado: ReferenciaCiudad | null, minListados: number) {
  const ref = new Map(ciudades.map((c) => [c.ciudad, c]));
  return {
    max: MAX_COMPARAR,
    min_listados_estadistica: minListados,
    ciudades_referencia: ciudades,
    estado_referencia: estado,
    items: filas.map(({ lugar, de, ambito_pos, ...z }) => {
      const local = ref.get(z.ciudad);
      const c = local && local.zonas >= MIN_ZONAS_REFERENCIA ? local : estado;
      return {
        ...z,
        posicion_precio_m2: lugar != null ? { lugar, de, ambito: ambito_pos } : null,
        referencia: c?.ciudad ?? null,
        renta_vs_ciudad_pct: z.renta_mediana != null && c?.renta_mediana ? redondear((z.renta_mediana / c.renta_mediana - 1) * 100) : null,
        paradas_por_km2: z.area_km2 ? redondear(z.num_paradas / z.area_km2) : null,
      };
    }),
  };
}
