/**
 * CLI de datos de CIVITAS (mismo paquete y mismas dependencias que la API).
 *   node dist/cli.js mvp2 [--fuente fixture|real] [--desde-cero] [...]
 *   node dist/cli.js mvp3 [--fuente fixture|real] [--listados <archivo>]   (requiere haber corrido mvp2)
 *   node dist/cli.js recaptura [--cada-dias 7] | mvp4 | validar-mvp4
 *   node dist/cli.js migrar | validar | validar-mvp3
 */
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { conectar, migrar } from './etl/db';
import { nuevaConfig } from './etl/config';
import { correrMvp2 } from './etl/pipeline';
import { correrMvp3 } from './etl/renta/pipeline';
import { programar, recapturar } from './etl/mvp4/recaptura';
import * as validacionMvp4 from './etl/mvp4/validacion';
import * as validacionMvp3 from './etl/renta/validacion';
import * as validacion from './etl/validacion';

const AYUDA = `Uso: civitas-etl <mvp2|mvp3|recaptura|mvp4|migrar|validar|validar-mvp3|validar-mvp4> [opciones]

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
  mvp3      Importa listados de renta (1 fuente), normaliza, deduplica, asigna zona y genera el reporte de calidad.
            Requiere las zonas de MVP-2 (corre antes \`mvp2\`) y el ADR-002 (docs/mvp3).
    --fuente fixture|real      (por defecto fixture: listados SINTÉTICOS)
    --listados <archivo>       CSV (plantilla de captura manual) o ZIP; en modo real, también data/raw/rentas/
    --fuente-renta <clave>     Parser a usar (por defecto renta_captura_manual)
    --min-listados 300         Listados con zona para aprobar
    --umbral-nulos 0.10        Fracción máxima de listados con campos clave nulos (umbral propuesto)
  recaptura Recaptura de precios (MVP-4): vuelve a ingerir los archivos de renta, de forma idempotente, y registra cada ejecución o fallo.
            Acepta las opciones de mvp3 (--fuente, --listados, ...).
    --cada-dias N              Se queda corriendo y repite cada N días (servicio \`recaptura\` del compose); sin esto corre una vez
  mvp4      Una recaptura (si aún no hay ninguna) y el checklist «Para pasar» de MVP-4
  migrar        Aplica db/migrations
  validar       Ejecuta solo el checklist de MVP-2 sobre lo ya cargado
  validar-mvp3  Ejecuta solo el checklist de MVP-3 sobre lo ya cargado
  validar-mvp4  Ejecuta solo el checklist de MVP-4 sobre lo ya cargado
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
      listados: { type: 'string' }, 'fuente-renta': { type: 'string', default: 'renta_captura_manual' },
      'min-listados': { type: 'string', default: '300' }, 'umbral-nulos': { type: 'string', default: '0.1' },
      'cada-dias': { type: 'string' },
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
  if (cmd === 'validar-mvp3') {
    const conn = await conectar(cfg.databaseUrl);
    try {
      const checks = await validacionMvp3.ejecutar(conn, cfg);
      const ok = await validacionMvp3.guardar(conn, checks, 'n/d');
      validacion.imprimir(checks);
      return ok ? 0 : 1;
    } finally { await conn.close(); }
  }
  if (cmd === 'validar-mvp4') {
    const conn = await conectar(cfg.databaseUrl);
    try {
      const checks = await validacionMvp4.ejecutar(conn, cfg);
      const ok = await validacionMvp4.guardar(conn, checks, await validacionMvp4.modoDeDatos(conn));
      validacion.imprimir(checks);
      return ok ? 0 : 1;
    } finally { await conn.close(); }
  }
  if (cmd === 'recaptura' || cmd === 'mvp4') {
    if (a.fuente !== 'fixture' && a.fuente !== 'real') { console.error("--fuente debe ser 'fixture' o 'real'"); return 2; }
    const cada = a['cada-dias'] === undefined ? undefined : Number(a['cada-dias']);
    if (cada !== undefined && !(cada > 0 && cada <= 24)) { console.error('--cada-dias debe estar entre 0 (exclusivo) y 24'); return 2; }
    const [minListados, umbralNulos] = [Number(a['min-listados']), Number(a['umbral-nulos'])];
    Object.assign(cfg, {
      modo: a.fuente, fuenteRenta: a['fuente-renta'], rutaListados: a.listados, minListados, umbralNulos,
      comando: 'civitas_etl ' + argv.map((x) => (/^[\w@%+=:,./-]+$/.test(x) ? x : `'${x}'`)).join(' ') + (cada !== undefined ? ' [programada]' : ''),
    });
    try {
      if (cada !== undefined) {
        const ctl = new AbortController();
        for (const sig of ['SIGINT', 'SIGTERM'] as const) process.once(sig, () => ctl.abort());
        await programar(cfg, cada, ctl.signal);
        return 0;
      }
      if (cmd === 'recaptura') return (await recapturar(cfg)) ? 0 : 1;
      // mvp4: asegura al menos una recaptura y evalúa el checklist
      const conn = await conectar(cfg.databaseUrl);
      try {
        await migrar(conn);
        const hay = Number((await conn.one("SELECT count(*) AS n FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'ok'")).n);
        if (!hay) await recapturar({ ...cfg, comando: cfg.comando.replace(/^civitas_etl mvp4/, 'civitas_etl recaptura (desde mvp4)') });
        const checks = await validacionMvp4.ejecutar(conn, cfg);
        const ok = await validacionMvp4.guardar(conn, checks, await validacionMvp4.modoDeDatos(conn));
        console.log(`\nMVP-4 · validación — ${ok ? 'APROBADO' : 'NO APROBADO'}`);
        validacion.imprimir(checks);
        return ok ? 0 : 1;
      } finally { await conn.close(); }
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT' || err.code === 'EACCES' || err.message?.startsWith('Modo real:') || err.message?.startsWith('MVP-3:')) {
        console.error(`ERROR: ${err.message}`);
        return 2;
      }
      throw e;
    }
  }
  if (cmd === 'mvp3') {
    if (a.fuente !== 'fixture' && a.fuente !== 'real') { console.error("--fuente debe ser 'fixture' o 'real'"); return 2; }
    const [minListados, umbralNulos] = [Number(a['min-listados']), Number(a['umbral-nulos'])];
    if (!Number.isInteger(minListados) || minListados < 1) { console.error('--min-listados debe ser un entero ≥ 1'); return 2; }
    if (!(umbralNulos > 0 && umbralNulos <= 1)) { console.error('--umbral-nulos debe estar entre 0 (exclusivo) y 1'); return 2; }
    Object.assign(cfg, {
      modo: a.fuente, fuenteRenta: a['fuente-renta'], rutaListados: a.listados, minListados, umbralNulos,
      comando: 'civitas_etl ' + argv.map((x) => (/^[\w@%+=:,./-]+$/.test(x) ? x : `'${x}'`)).join(' '),
    });
    try {
      return (await correrMvp3(cfg)) ? 0 : 1;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT' || err.code === 'EACCES' || err.message?.startsWith('Modo real:') || err.message?.startsWith('MVP-3:')) {
        console.error(`ERROR: ${err.message}`);
        return 2;
      }
      throw e;
    }
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
