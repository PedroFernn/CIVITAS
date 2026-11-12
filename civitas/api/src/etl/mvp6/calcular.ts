/** MVP-6 · H6: calcula las anomalías de los listados con el motor v1 y guarda un veredicto por listado. */
import { existsSync, readFileSync } from 'node:fs';
import { calibrar, clasificar, evaluar, Etiqueta, ListadoEntrada, Metricas, UMBRAL_POR_DEFECTO, Veredicto } from '../../anomalias/motor';
import { Conn } from '../db';

/** Muestra de referencia. `sembrado` = el generador de la demo plantó los precios anómalos (no es juicio humano). */
export interface Etiquetas { origen: 'humano' | 'sembrado' | 'desconocido'; porIdFuente: Map<string, Etiqueta>; archivo: string }

const ETIQUETAS_VALIDAS = new Set<string>(['justo', 'inflado', 'subprecio']);

/** CSV `id_anuncio,etiqueta`; una primera línea `# origen=humano|sembrado` declara de dónde salen las etiquetas. */
export function leerEtiquetas(archivo: string): Etiquetas {
  const lineas = readFileSync(archivo, 'utf8').split(/\r?\n/);
  const origenDecl = /^#\s*origen\s*=\s*(\w+)/i.exec(lineas[0] ?? '')?.[1]?.toLowerCase();
  const origen = origenDecl === 'humano' || origenDecl === 'sembrado' ? origenDecl : 'desconocido';
  const mapa = new Map<string, Etiqueta>();
  for (const l of lineas) {
    if (!l.trim() || l.startsWith('#') || l.toLowerCase().startsWith('id_anuncio')) continue;
    const [id, et] = l.split(',').map((x) => x.trim());
    if (id && ETIQUETAS_VALIDAS.has(et)) mapa.set(id, et as Etiqueta);
  }
  return { origen, porIdFuente: mapa, archivo };
}

export function etiquetasSiExisten(ruta?: string): Etiquetas | null {
  return ruta && existsSync(ruta) ? leerEtiquetas(ruta) : null;
}

export interface ResumenAnomalias {
  conSuperficie: number;
  etiquetados: number;
  conteo: Record<Etiqueta, number>;
  niveles: Record<'zona' | 'municipio' | 'estado', number>;
  umbral: number;
  calibrado: boolean;
  criterioCalibracion: 'precision' | 'f1' | null;
  tablaCalibracion: { umbral: number; m: Metricas }[];
  metricas: Metricas | null;
  etiquetas: Etiquetas | null;
  /** Cuántas etiquetas del archivo corresponden a listados cargados (el archivo puede traer más, o de otra carga). */
  etiquetasCoinciden: number;
}

export async function calcularAnomalias(conn: Conn, opciones: { umbral?: number; etiquetas?: Etiquetas | null } = {}): Promise<ResumenAnomalias> {
  const filas = await conn.query(
    `SELECT l.id::int AS id, l.id_fuente, l.zona_id, z.cve_mun, l.tipo_inmueble, l.recamaras, l.precio_m2::float AS m2
       FROM listados_renta l LEFT JOIN colonias z ON z.id = l.zona_id WHERE l.precio_m2 IS NOT NULL ORDER BY l.id`);
  const entrada: ListadoEntrada[] = filas.map((r) => ({
    id: Number(r.id), zonaId: (r.zona_id as string | null) ?? null, cveMun: (r.cve_mun as string | null) ?? null,
    tipo: r.tipo_inmueble as string, recamaras: r.recamaras === null ? null : Number(r.recamaras), precioM2: Number(r.m2),
  }));

  // referencia por id de base (las etiquetas vienen por el identificador del anuncio en la fuente)
  const etiquetas = opciones.etiquetas ?? null;
  const referencia = new Map<number, Etiqueta>();
  if (etiquetas) for (const r of filas) { const e = etiquetas.porIdFuente.get(r.id_fuente as string); if (e) referencia.set(Number(r.id), e); }

  let umbral = opciones.umbral ?? UMBRAL_POR_DEFECTO, calibrado = false, criterio: 'precision' | 'f1' | null = null, tabla: { umbral: number; m: Metricas }[] = [];
  if (opciones.umbral === undefined && referencia.size) { const c = calibrar(entrada, referencia); umbral = c.umbral; tabla = c.tabla; calibrado = true; criterio = c.criterio; }

  const veredictos: Veredicto[] = clasificar(entrada, umbral);
  await conn.tx(async () => {
    await conn.query('DELETE FROM listados_anomalias');
    for (let i = 0; i < veredictos.length; i += 2000) {
      const lote = veredictos.slice(i, i + 2000);
      await conn.query(
        `INSERT INTO listados_anomalias (listado_id, etiqueta, z_robusto, nivel, mediana_m2, n_grupo, umbral)
         SELECT * FROM unnest($1::bigint[], $2::text[], $3::numeric[], $4::text[], $5::numeric[], $6::int[], $7::numeric[])`,
        [lote.map((v) => v.id), lote.map((v) => v.etiqueta), lote.map((v) => v.z), lote.map((v) => v.nivel),
         lote.map((v) => v.medianaM2), lote.map((v) => v.nGrupo), lote.map(() => umbral)]);
    }
  });

  const conteo = { justo: 0, inflado: 0, subprecio: 0 } as Record<Etiqueta, number>;
  const niveles = { zona: 0, municipio: 0, estado: 0 };
  for (const v of veredictos) { conteo[v.etiqueta]++; niveles[v.nivel]++; }
  return {
    conSuperficie: entrada.length, etiquetados: veredictos.length, conteo, niveles, umbral, calibrado, criterioCalibracion: criterio, tablaCalibracion: tabla,
    metricas: referencia.size ? evaluar(veredictos, referencia) : null, etiquetas, etiquetasCoinciden: referencia.size,
  };
}
