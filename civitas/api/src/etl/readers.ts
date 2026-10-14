/** Lectores de fuentes abiertas. Formatos estándar (interoperabilidad): GeoJSON/Shapefile, CSV de DENUE, GTFS stops.txt. */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { parse } from 'csv-parse';
import proj4 from 'proj4';
import * as shapefile from 'shapefile';
import unzipper from 'unzipper';

// ───────────────────────── Zonas (Marco Geoestadístico) ─────────────────────────
export interface ZonaRaw {
  referencia: string; // para mensajes de descarte
  claveGeo: string | null;
  cveEnt: string | null;
  cveMun: string | null;
  nombre: string | null;
  geojson: string | null; // geometría GeoJSON en EPSG:4326
}

type Props = Record<string, unknown>;

export function prop(props: Props, ...nombres: string[]): string | null {
  const bajo = new Map(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  for (const n of nombres) {
    const v = bajo.get(n.toLowerCase());
    if (v !== undefined && v !== null && v !== '') return String(v).trim();
  }
  return null;
}

function claveAgeb(props: Props): string | null {
  const clave = prop(props, 'cvegeo', 'clave_geo');
  if (clave) return clave;
  const partes = ['cve_ent', 'cve_mun', 'cve_loc', 'cve_ageb'].map((p) => prop(props, p));
  return partes.every(Boolean) ? partes.join('') : null;
}

function zonaDe(props: Props, geometry: unknown, refVacia: string): ZonaRaw {
  const clave = claveAgeb(props);
  return {
    referencia: clave ?? refVacia,
    claveGeo: clave,
    cveEnt: prop(props, 'cve_ent') ?? (clave ? clave.slice(0, 2) : null),
    cveMun: prop(props, 'cve_mun') ?? (clave ? clave.slice(2, 5) : null),
    nombre: prop(props, 'nombre', 'nomgeo'),
    geojson: geometry ? JSON.stringify(geometry) : null,
  };
}

/** Reproyecta recursivamente las coordenadas de una geometría GeoJSON. */
export function reproyectar(geom: any, transformar: (p: number[]) => number[]): any {
  const rec = (c: any): any => (typeof c[0] === 'number' ? transformar(c) : c.map(rec));
  return { ...geom, coordinates: rec(geom.coordinates) };
}

export async function* leerZonas(file: string): AsyncGenerator<ZonaRaw> {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.geojson' || ext === '.json') {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    let i = 0;
    for (const feat of data.features ?? []) {
      yield zonaDe(feat.properties ?? {}, feat.geometry, `feature[${i}]`);
      i++;
    }
    return;
  }
  if (ext === '.shp') {
    const base = file.slice(0, -ext.length);
    const prj = [`${base}.prj`, `${base}.PRJ`].find(existsSync);
    if (!prj) throw new Error(`${path.basename(file)}: falta el .prj; no se puede conocer el CRS (reproyecta o define el .prj)`);
    const wkt = readFileSync(prj, 'utf8');
    let conv: proj4.Converter;
    try {
      conv = proj4(wkt, 'WGS84');
    } catch {
      throw new Error(`${path.basename(file)}: CRS del .prj no reconocido; reproyecta a EPSG:4326 o corrige el .prj`);
    }
    const dbf = [`${base}.dbf`, `${base}.DBF`].find(existsSync);
    const cpg = [`${base}.cpg`, `${base}.CPG`].find(existsSync);
    const encoding = cpg ? readFileSync(cpg, 'utf8').trim() : 'utf-8';
    const src = await shapefile.open(file, dbf, { encoding });
    let i = 0;
    for (;;) {
      const r = await src.read();
      if (r.done) break;
      const f = r.value as any;
      const geom = f.geometry ? reproyectar(f.geometry, (p) => conv.forward(p.slice(0, 2))) : null;
      yield zonaDe(f.properties ?? {}, geom, `registro[${i}]`);
      i++;
    }
    return;
  }
  throw new Error(
    `${path.basename(file)}: formato de zonas no soportado (${ext || 'sin extensión'}). ` +
      'Usa .shp (con .dbf y .prj) o .geojson; un .gpkg se convierte con: ogr2ogr -f GeoJSON -t_srs EPSG:4326 zonas.geojson entrada.gpkg',
  );
}

// ───────────────────────── Texto delimitado (DENUE, GTFS) ─────────────────────────
type Fila = Record<string, string | undefined>;

/** Bytes del archivo, o del miembro CSV/TXT de un .zip (excluye diccionarios y catálogos). */
async function abrirBytes(file: string, preferido?: string): Promise<() => Readable> {
  if (path.extname(file).toLowerCase() !== '.zip') return () => createReadStream(file);
  const dir = await unzipper.Open.file(file);
  const candidatos = dir.files
    .filter((e) => /\.(csv|txt)$/i.test(e.path) && !/diccionario|catalogo/i.test(e.path))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  if (!candidatos.length) throw new Error(`${path.basename(file)}: no contiene un CSV utilizable`);
  const elegido = (preferido && candidatos.find((e) => path.basename(e.path).toLowerCase() === preferido)) || candidatos[0];
  return () => elegido.stream();
}

async function detectarCodificacion(abrir: () => Readable): Promise<'utf8' | 'latin1'> {
  const muestra: Buffer[] = [];
  let n = 0;
  const s = abrir();
  for await (const b of s) {
    muestra.push(b as Buffer);
    n += (b as Buffer).length;
    if (n >= 1 << 20) break;
  }
  s.destroy();
  try {
    // stream:true tolera un carácter multibyte partido en el borde de la muestra
    new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(muestra).subarray(0, 1 << 20), { stream: true });
    return 'utf8';
  } catch {
    return 'latin1';
  }
}

const norm = (h: string) => h.trim().toLowerCase().replace(/ /g, '_');

async function* filasCsv(file: string, preferido?: string): AsyncGenerator<{ fila: number; row: Fila }> {
  const abrir = await abrirBytes(file, preferido);
  const enc = await detectarCodificacion(abrir);
  const dec = new StringDecoder(enc);
  let primera = true;
  const texto = abrir().pipe(
    new Transform({
      readableObjectMode: false,
      transform(chunk: Buffer, _e: string, cb: (e: null, d: string) => void) {
        let s = dec.write(chunk);
        if (primera && s) { primera = false; if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); }
        cb(null, s);
      },
      flush(cb: (e: null, d: string) => void) { cb(null, dec.end()); },
    }),
  );
  const parser = texto.pipe(
    parse({ columns: (h: string[]) => h.map(norm), skip_empty_lines: true, relax_column_count: true, bom: false }),
  );
  let fila = 1;
  for await (const row of parser) yield { fila: ++fila, row };
}

function get(row: Fila, ...alias: string[]): string | null {
  for (const a of alias) {
    const v = row[a];
    if (v !== undefined && v !== '') return v.trim();
  }
  return null;
}

// ───────────────────────── DENUE ─────────────────────────
export interface UnidadRaw {
  fila: number;
  idDenue: string | null;
  nombre: string | null;
  codigoAct: string | null;
  nombreAct: string | null;
  estrato: string | null;
  cveEnt: string | null;
  cveMun: string | null;
  lat: string | null;
  lon: string | null;
}

export async function* leerDenue(file: string): AsyncGenerator<UnidadRaw> {
  for await (const { fila, row } of filasCsv(file)) {
    yield {
      fila,
      idDenue: get(row, 'id', 'clee', 'id_denue'),
      nombre: get(row, 'nom_estab', 'nombre'),
      codigoAct: get(row, 'codigo_act', 'scian', 'cve_act'),
      nombreAct: get(row, 'nombre_act', 'nom_act'),
      estrato: get(row, 'per_ocu', 'estrato'),
      cveEnt: get(row, 'cve_ent'),
      cveMun: get(row, 'cve_mun'),
      lat: get(row, 'latitud', 'lat', 'y'),
      lon: get(row, 'longitud', 'lon', 'lng', 'x'),
    };
  }
}

// ───────────────────────── Paradas de transporte ─────────────────────────
export interface ParadaRaw {
  fila: number;
  referencia: string | null;
  nombre: string | null;
  modo: string | null;
  lat: string | null;
  lon: string | null;
}

export async function* leerParadas(file: string): AsyncGenerator<ParadaRaw> {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.geojson' || ext === '.json') {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    let i = 0;
    for (const f of data.features ?? []) {
      i++;
      const g = f.geometry ?? {};
      const p = f.properties ?? {};
      let lon: string | null = null;
      let lat: string | null = null;
      if (g.type === 'Point') [lon, lat] = g.coordinates.slice(0, 2).map(String);
      yield { fila: i, referencia: prop(p, 'stop_id', 'id', 'referencia', 'clave'), nombre: prop(p, 'stop_name', 'nombre', 'name'), modo: prop(p, 'modo', 'mode'), lat, lon };
    }
    return;
  }
  for await (const { fila, row } of filasCsv(file, 'stops.txt')) {
    yield {
      fila,
      referencia: get(row, 'stop_id', 'id', 'referencia', 'clave'),
      nombre: get(row, 'stop_name', 'nombre', 'name'),
      modo: get(row, 'modo', 'mode'),
      lat: get(row, 'stop_lat', 'lat', 'latitud', 'y'),
      lon: get(row, 'stop_lon', 'lon', 'lng', 'longitud', 'x'),
    };
  }
}
