/**
 * Parser de la plantilla de captura manual (data/plantillas/renta_captura_manual.csv). Es el único conocimiento del
 * formato de esta fuente: un parser por fuente, aislado del resto del ETL (RNF Interoperabilidad).
 */
import { filasCsv, get } from '../../readers';
import { ListadoCrudo, ParserRenta } from '../tipos';

/** Columnas que el parser lee (tras normalizar el encabezado: minúsculas y "_" por espacios). */
const LEIDAS = new Set([
  'id_anuncio', 'id', 'id_fuente', 'url', 'enlace', 'tipo', 'tipo_inmueble', 'precio', 'renta', 'precio_mensual', 'moneda',
  'superficie_m2', 'm2', 'superficie', 'area', 'recamaras', 'recámaras', 'habitaciones', 'rec', 'latitud', 'lat',
  'longitud', 'lon', 'lng', 'fecha_publicacion', 'publicado', 'fecha',
]);
/** Columnas que NUNCA se leen aunque existan: contacto/anunciante (privacidad) y texto libre (puede traer teléfonos). */
const SENSIBLE = /(tel|cel|whats|phone|fono|contact|anunciante|vendedor|propietari|due[ñn]o|agente|inmobiliaria|asesor|correo|mail|persona|nombre)/i;
const TEXTO_LIBRE = /(descrip|titulo|título|comentari|nota|observ|detalle)/i;

export const detectarColumnasSensibles = (columnas: string[]): string[] =>
  columnas.filter((c) => !LEIDAS.has(c) && (SENSIBLE.test(c) || TEXTO_LIBRE.test(c)));

export const capturaManual: ParserRenta = {
  clave: 'renta_captura_manual',
  nombre: 'Listados de renta · captura manual (plantilla CSV)',
  async *leer(archivo, avisos) {
    const iter = filasCsv(archivo, undefined, (cols) => {
      avisos.columnasSensibles = detectarColumnasSensibles(cols);
    });
    for await (const { fila, row } of iter) {
      // Solo se construyen los campos del contrato: el resto de columnas del archivo no sale de aquí.
      yield {
        fila,
        idFuente: get(row, 'id_anuncio', 'id', 'id_fuente'),
        url: get(row, 'url', 'enlace'),
        tipo: get(row, 'tipo', 'tipo_inmueble'),
        precio: get(row, 'precio', 'renta', 'precio_mensual'),
        moneda: get(row, 'moneda'),
        superficie: get(row, 'superficie_m2', 'm2', 'superficie', 'area'),
        recamaras: get(row, 'recamaras', 'recámaras', 'habitaciones', 'rec'),
        lat: get(row, 'latitud', 'lat'),
        lon: get(row, 'longitud', 'lon', 'lng'),
        publicado: get(row, 'fecha_publicacion', 'publicado', 'fecha'),
      } satisfies ListadoCrudo;
    }
  },
};
