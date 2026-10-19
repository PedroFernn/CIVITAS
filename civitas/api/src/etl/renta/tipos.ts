/**
 * Contrato de los parsers de listados de renta (RNF Interoperabilidad: un parser aislado por fuente).
 *
 * PRIVACIDAD (RNF): `ListadoCrudo` NO tiene campos de teléfono, correo, nombre del anunciante ni texto libre. Un parser
 * que intente pasarlos no compila (el literal de objeto tendría propiedades de más) y el cargador solo lee estos campos.
 * Todos los valores llegan como texto tal cual vienen en la fuente; la normalización es común y vive en `normalizar.ts`.
 */
export interface ListadoCrudo {
  fila: number;
  idFuente: string | null;
  url: string | null;
  tipo: string | null;
  precio: string | null;
  moneda: string | null;
  superficie: string | null;
  recamaras: string | null;
  lat: string | null;
  lon: string | null;
  publicado: string | null;
}

/** Lo que el parser observa del archivo y no es un listado (se publica en el reporte de calidad). */
export interface AvisosLectura {
  /** Columnas del archivo que NO se leyeron porque parecen contener datos personales o texto libre. */
  columnasSensibles: string[];
}

export interface ParserRenta {
  /** Igual a `fuentes_datos.clave`. */
  readonly clave: string;
  readonly nombre: string;
  leer(archivo: string, avisos: AvisosLectura): AsyncGenerator<ListadoCrudo>;
}

export type TipoInmueble = 'departamento' | 'casa' | 'cuarto' | 'otro';
export const TIPOS_INMUEBLE: readonly TipoInmueble[] = ['departamento', 'casa', 'cuarto', 'otro'];
