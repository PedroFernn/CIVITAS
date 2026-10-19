/** Registro de parsers de listados de renta. Agregar una fuente = un archivo en fuentes/ + una línea aquí + su fila en fuentes_datos. */
import { capturaManual } from './fuentes/captura-manual';
import { ParserRenta } from './tipos';

export const PARSERS: ReadonlyMap<string, ParserRenta> = new Map<string, ParserRenta>([[capturaManual.clave, capturaManual]]);

export function obtenerParser(clave: string): ParserRenta {
  const p = PARSERS.get(clave);
  if (!p) {
    throw new Error(`MVP-3: no hay un parser registrado para la fuente '${clave}' (registrados: ${[...PARSERS.keys()].join(', ')}).`);
  }
  return p;
}
