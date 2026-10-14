/**
 * CLI de datos de CIVITAS (mismo paquete y mismas dependencias que la API).
 *   node dist/cli.js mvp2 [--fuente fixture|real] [--desde-cero] [...]
 *   node dist/cli.js migrar | validar
 */
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { conectar, migrar } from './etl/db';
import { nuevaConfig } from './etl/config';
import { correrMvp2 } from './etl/pipeline';
import * as validacion from './etl/validacion';

const AYUDA = `Uso: civitas-etl <mvp2|migrar|validar> [opciones]

  mvp2      Importa INEGI (MGN, DENUE) + transporte, calcula atributos y valida
    --fuente fixture|real      (por defecto fixture)
    --zonas <archivo>          MGN: AGEB urbanas (.shp/.geojson)
    --denue <archivo>          DENUE: CSV o ZIP
    --transporte <archivo>     Paradas: GTFS stops.txt, CSV, GeoJSON o ZIP
    --sistema-transporte <n>   Nombre del sistema (p. ej. RUTA)
    --ciudad Puebla  --cve-ent 21  --cve-mun 114
    --zonas-piloto 30  --min-comercios 1
    --lista-piloto <archivo>   CVEGEO (uno por línea) para forzar los pilotos
    --desde-cero               Recrea el esquema antes de importar (solo hosts locales)
  migrar    Aplica db/migrations
  validar   Ejecuta solo el checklist de MVP-2 sobre lo ya cargado
`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...resto] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help') { console.log(AYUDA); return cmd ? 0 : 2; }
  const { values: a } = parseArgs({
    args: resto,
    options: {
      fuente: { type: 'string', default: 'fixture' }, zonas: { type: 'string' }, denue: { type: 'string' },
      transporte: { type: 'string' }, 'sistema-transporte': { type: 'string' }, ciudad: { type: 'string', default: 'Puebla' },
      'cve-ent': { type: 'string', default: '21' }, 'cve-mun': { type: 'string', default: '114' },
      'zonas-piloto': { type: 'string', default: '30' }, 'min-comercios': { type: 'string', default: '1' },
      'lista-piloto': { type: 'string' }, 'desde-cero': { type: 'boolean', default: false },
    },
  });
  const cfg = nuevaConfig();

  if (cmd === 'migrar') {
    const conn = await conectar(cfg.databaseUrl);
    try { console.log('aplicadas:', (await migrar(conn)).join(', ') || 'ninguna (al día)'); } finally { await conn.close(); }
    return 0;
  }
  if (cmd === 'validar') {
    const conn = await conectar(cfg.databaseUrl);
    try {
      const checks = await validacion.ejecutar(conn, cfg);
      const ok = await validacion.guardar(conn, checks, 'n/d');
      validacion.imprimir(checks);
      return ok ? 0 : 1;
    } finally { await conn.close(); }
  }
  if (cmd !== 'mvp2') { console.error(`Comando desconocido: ${cmd}\n\n${AYUDA}`); return 2; }

  if (a.fuente !== 'fixture' && a.fuente !== 'real') { console.error("--fuente debe ser 'fixture' o 'real'"); return 2; }
  Object.assign(cfg, {
    modo: a.fuente, ciudad: a.ciudad, cveEnt: a['cve-ent'], cveMun: a['cve-mun'],
    zonasPiloto: Number(a['zonas-piloto']), minComercios: Number(a['min-comercios']),
    rutaZonas: a.zonas, rutaDenue: a.denue, rutaTransporte: a.transporte, listaPiloto: a['lista-piloto'],
    comando: 'civitas_etl ' + resto.map((x) => (/^[\w@%+=:,./-]+$/.test(x) ? x : `'${x}'`)).join(' '),
  });
  if (a['sistema-transporte']) cfg.sistemaTransporte = a['sistema-transporte'];
  try {
    return (await correrMvp2(cfg, a['desde-cero'], process.env.CIVITAS_ALLOW_RESET === '1')) ? 0 : 1;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT' || err.code === 'EACCES' || err.message?.startsWith('Modo real:') || err.message?.includes('--desde-cero rechazado')) {
      console.error(`ERROR: ${err.message}`);
      return 2;
    }
    throw e;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
}
