/** MVP-3 · Ingesta de precios de renta: parser → normalización → deduplicación → zona → reporte de calidad → checklist. */
import { conCarga } from '../cargas';
import { Config, resolverRutasRenta } from '../config';
import { conectar, Conn, migrar } from '../db';
import * as validacionMvp2 from '../validacion';
import { escribirArchivosReporte, generarReporte, guardarReporte } from './calidad';
import { EstadisticasCarga } from './estadisticas';
import { asignarZonaListados, cargarListados, limpiarOtroModoRenta } from './loader';
import { obtenerParser } from './registro';
import * as validacion from './validacion';

async function exigirZonas(conn: Conn): Promise<void> {
  const n = Number((await conn.one('SELECT count(*) AS n FROM colonias')).n);
  if (n === 0) {
    throw new Error('MVP-3: no hay zonas cargadas. Corre primero `etl mvp2` (los listados se asignan a las AGEB de MVP-2).');
  }
}

export async function correrMvp3(cfg: Config): Promise<boolean> {
  resolverRutasRenta(cfg);
  const parser = obtenerParser(cfg.fuenteRenta);
  const conn = await conectar(cfg.databaseUrl);
  try {
    await migrar(conn);
    await exigirZonas(conn);
    await limpiarOtroModoRenta(conn, cfg.modo);

    const est = new EstadisticasCarga();
    const cargaId = await conCarga(conn, parser.clave, cfg.modo, cfg.rutaListados, cfg.comando, null, async (c) => {
      await cargarListados(conn, cfg, parser, c, est);
      await asignarZonaListados(conn); // dentro de la carga: si falla, queda registrada como error
      return c.id;
    });

    const reporte = await generarReporte(conn, cfg, cargaId, est);
    await guardarReporte(conn, reporte);
    escribirArchivosReporte(reporte);

    const checks = await validacion.ejecutar(conn, cfg);
    const aprobada = await validacion.guardar(conn, checks, cfg.modo);
    console.log(`\nMVP-3 · validación (${cfg.modo}) — ${aprobada ? 'APROBADO' : 'NO APROBADO'}`);
    validacionMvp2.imprimir(checks);
    return aprobada;
  } finally {
    await conn.close();
  }
}
