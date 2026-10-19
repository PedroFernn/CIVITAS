import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Raíz del repo (o /app en la imagen). Desde api/src/etl y api/dist/etl son tres niveles hacia arriba. */
export const ROOT = process.env.CIVITAS_ROOT ?? path.resolve(__dirname, '../../..');
export const FIXTURES = path.join(ROOT, 'data', 'fixtures');
export const MIGRATIONS = path.join(ROOT, 'db', 'migrations');
export const RAW_DIR = path.join(ROOT, 'data', 'raw');
export const REPORTS = path.join(ROOT, 'data', 'reports');
// ADR-001: en la imagen vive en <raíz>/docs/mvp2; en el repo, en docs/mvp2 junto a la carpeta civitas/.
export const ADR_UNIDAD_ZONA =
  [path.join(ROOT, 'docs', 'mvp2'), path.join(ROOT, '..', 'docs', 'mvp2')]
    .map((d) => path.join(d, 'ADR-001-unidad-de-zona.md'))
    .find(existsSync) ?? path.join(ROOT, 'docs', 'mvp2', 'ADR-001-unidad-de-zona.md');

// ADR-002 (MVP-3): decisión scraping vs. captura manual y revisión de términos de uso de la fuente de rentas.
export const ADR_FUENTE_RENTA =
  [path.join(ROOT, 'docs', 'mvp3'), path.join(ROOT, '..', 'docs', 'mvp3')]
    .map((d) => path.join(d, 'ADR-002-fuente-renta.md'))
    .find(existsSync) ?? path.join(ROOT, 'docs', 'mvp3', 'ADR-002-fuente-renta.md');

export const DEFAULT_DB = 'postgresql://civitas:civitas@localhost:5432/civitas';

/** Unidad de zona decidida en ADR-001 */
export const TIPO_UNIDAD = 'ageb';

export interface Config {
  databaseUrl: string;
  modo: 'fixture' | 'real';
  ciudad: string;
  cveEnt: string;
  cveMun: string;
  zonasPiloto: number;
  minComercios: number;
  rutaZonas?: string;
  rutaDenue?: string;
  rutaTransporte?: string;
  sistemaTransporte: string;
  listaPiloto?: string;
  comando: string;
  /** Directorio base de data/raw (inyectable para pruebas) */
  rawDir: string;

  // ── MVP-3 · precios de renta ──
  /** Clave de la fuente (= parser registrado = fuentes_datos.clave) */
  fuenteRenta: string;
  rutaListados?: string;
  /** PARA PASAR: ≥ N listados con zona asignada */
  minListados: number;
  /** PARA PASAR: fracción máxima (exclusiva) de listados leídos con algún campo clave nulo. Umbral propuesto: 10 % */
  umbralNulos: number;
  /** Rango plausible de renta mensual en MXN; fuera de él el listado se descarta (error de captura) */
  precioMin: number;
  precioMax: number;
  /** ADR-002 (inyectable para pruebas) */
  adrRenta: string;
}

export function nuevaConfig(parcial: Partial<Config> = {}): Config {
  return {
    databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DB,
    modo: 'fixture',
    ciudad: 'Puebla',
    cveEnt: '21', // Puebla
    cveMun: '114', // Puebla (municipio capital)
    zonasPiloto: 30, // RF: ≥30 zonas piloto
    minComercios: 1, // una zona piloto debe tener al menos N comercios
    sistemaTransporte: 'GTFS',
    comando: '',
    rawDir: RAW_DIR,
    fuenteRenta: 'renta_captura_manual',
    minListados: 300, // RF-1.2 / MVP-3: ≥300 listados con zona asignada
    umbralNulos: 0.1, // MVP-3: <10 % con campos clave nulos (umbral propuesto)
    precioMin: 1_000,
    precioMax: 250_000,
    adrRenta: ADR_FUENTE_RENTA,
    ...parcial,
  };
}

export function resolverRutas(cfg: Config): void {
  if (cfg.modo === 'fixture') {
    cfg.rutaZonas ??= path.join(FIXTURES, 'mgn_ageb_fixture.geojson');
    cfg.rutaDenue ??= path.join(FIXTURES, 'denue_fixture.csv');
    cfg.rutaTransporte ??= path.join(FIXTURES, 'gtfs', 'stops.txt');
    cfg.sistemaTransporte = 'GTFS-fixture';
    return;
  }
  cfg.rutaZonas ??= envPath('CIVITAS_MGN_PATH') ?? descubrir(path.join(cfg.rawDir, 'mgn'), ['a.shp', 'ageb', '.gpkg', '.geojson'], true);
  cfg.rutaDenue ??= envPath('CIVITAS_DENUE_PATH') ?? descubrir(path.join(cfg.rawDir, 'denue'), ['.csv', '.zip']);
  cfg.rutaTransporte ??=
    envPath('CIVITAS_TRANSPORTE_PATH') ??
    descubrir(path.join(cfg.rawDir, 'transporte'), ['stops.txt', '.csv', '.geojson', '.zip']);
  const faltan = (
    [
      ['MGN (AGEB urbanas)', cfg.rutaZonas],
      ['DENUE', cfg.rutaDenue],
      ['transporte (paradas)', cfg.rutaTransporte],
    ] as const
  )
    .filter(([, r]) => !r)
    .map(([n]) => n);
  if (faltan.length) {
    throw new Error(
      `Modo real: faltan archivos de ${faltan.join(', ')}. Colócalos en data/raw/{mgn,denue,transporte}/ ` +
        'o pásalos con --zonas/--denue/--transporte (ver data/raw/README.md).',
    );
  }
}

/** MVP-3: ubica el archivo de listados de renta (fixture sintético o data/raw/rentas). */
export function resolverRutasRenta(cfg: Config): void {
  if (cfg.modo === 'fixture') {
    cfg.rutaListados ??= path.join(FIXTURES, 'renta_fixture.csv');
    return;
  }
  cfg.rutaListados ??= envPath('CIVITAS_RENTAS_PATH') ?? descubrir(path.join(cfg.rawDir, 'rentas'), ['.csv', '.zip']);
  if (!cfg.rutaListados) {
    throw new Error(
      'Modo real: falta el archivo de listados de renta. Colócalo en data/raw/rentas/ o pásalo con --listados ' +
        '(ver data/raw/README.md y data/plantillas/renta_captura_manual.csv).',
    );
  }
}

function envPath(v: string): string | undefined {
  return process.env[v] || undefined;
}

function recorrer(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = path.join(dir, n);
      return statSync(p).isDirectory() ? recorrer(p) : [p];
    });
}

/** Primer archivo (orden alfabético) que coincide con el primer patrón que tenga resultados. `shp` = sólo .shp. */
function descubrir(base: string, patrones: string[], shp = false): string | undefined {
  if (!existsSync(base)) return undefined;
  const todos = recorrer(base);
  for (const p of patrones) {
    const hit = todos.find((f) => {
      const n = path.basename(f).toLowerCase();
      if (shp && p === 'a.shp') return n.endsWith('a.shp');
      if (shp && p === 'ageb') return n.includes('ageb') && n.endsWith('.shp');
      return p.startsWith('.') ? n.endsWith(p) : n === p;
    });
    if (hit) return hit;
  }
  return undefined;
}
