import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { conCarga } from './cargas';
import { Config, REPORTS, resolverRutas } from './config';
import { conectar, migrar, resetTotal } from './db';
import { asignarYCalcularAtributos, cargarDenue, cargarParadas, cargarZonas, limpiarOtroModo, seleccionarPilotos } from './loaders';
import * as validacion from './validacion';

export async function correrMvp2(cfg: Config, desdeCero = false, resetPermitido = false): Promise<boolean> {
  resolverRutas(cfg);
  const conn = await conectar(cfg.databaseUrl);
  try {
    if (desdeCero) await resetTotal(conn, cfg.databaseUrl, resetPermitido);
    await migrar(conn);
    await limpiarOtroModo(conn, cfg.modo);

    await conCarga(conn, 'inegi_mgn', cfg.modo, cfg.rutaZonas, cfg.comando, null, (c) => cargarZonas(conn, cfg, c));
    await conCarga(conn, 'inegi_denue', cfg.modo, cfg.rutaDenue, cfg.comando, null, (c) => cargarDenue(conn, cfg, c));
    const ultima = await conCarga(conn, 'transporte_paradas', cfg.modo, cfg.rutaTransporte, cfg.comando, cfg.sistemaTransporte,
      async (c) => { await cargarParadas(conn, cfg, c); return c.id; });

    await asignarYCalcularAtributos(conn, ultima);
    console.info(`Zonas piloto seleccionadas: ${await seleccionarPilotos(conn, cfg)}`);

    const checks = await validacion.ejecutar(conn, cfg);
    const aprobada = await validacion.guardar(conn, checks, cfg.modo);
    console.log(`\nMVP-2 · validación (${cfg.modo}) — ${aprobada ? 'APROBADO' : 'NO APROBADO'}`);
    validacion.imprimir(checks);
    escribirReporte(checks, aprobada, cfg);
    return aprobada;
  } finally {
    await conn.close();
  }
}

function escribirReporte(checks: validacion.Check[], aprobada: boolean, cfg: Config): void {
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(path.join(REPORTS, 'mvp2_validacion.json'),
    JSON.stringify({ generado_en: new Date().toISOString(), modo: cfg.modo, aprobada, checks }, null, 2), 'utf8');
}
