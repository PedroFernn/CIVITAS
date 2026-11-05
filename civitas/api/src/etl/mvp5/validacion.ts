/** Checklist "PARA PASAR" de MVP-5 como código ejecutable (ver docs/mvp5/MVP5.md). */
import { existsSync, readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { Config, DOC_MVP5 } from '../config';
import { Conn } from '../db';
import { Check } from '../validacion';
import { enSerie, p95 } from '../mvp4/validacion';
import { DatabaseService } from '../../database/database.service';
import { OBJETIVO_ENTREVISTAS, resumirEntrevistas } from '../../entrevistas/validacion-entrevistas';
import { MIN_LISTADOS_ESTADISTICA } from '../../renta/filtros-renta';
import { MAX_COMPARAR, parseIdsComparacion } from '../../zonas/comparar';
import { parseFiltrosZonas } from '../../zonas/filtros-zonas';
import { ZonasService } from '../../zonas/zonas.service';
import { simularUsuarios } from './carga';

export const LATENCIA_BUSQUEDA_MAX_MS = 2000; // RNF Latencia: «búsqueda en <2 s»
export const USUARIOS_SIMULADOS = 50;         // RNF Rendimiento: «prueba con 50 usuarios simulados» (la meta de la Fase 0, miles, no se verifica en el MVP)

const mediana = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : 0);
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Pool real (como el de la API) para que los usuarios simulados compitan por conexiones de verdad; el ETL solo tiene un cliente. */
function servicioConPool(url: string) {
  const pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX ?? 10) });
  const db = { query: async (sql: string, params: unknown[] = []) => (await pool.query(sql, params as any[])).rows } as unknown as DatabaseService;
  return { svc: new ZonasService(db), cerrar: () => pool.end() };
}

/** Pura (se prueba aparte): ¿alcanzan las entrevistas con notas para pasar? */
export function evaluarEntrevistas(filas: { tipo: 'inquilino' | 'b2b'; notas: string | null; acepta_pagar: boolean | null }[]): { estado: Check['estado']; detalle: string } {
  const r = resumirEntrevistas(filas);
  const base = `${r.por_tipo.inquilino.hechas}/${OBJETIVO_ENTREVISTAS.inquilino} a inquilinos o estudiantes · ${r.por_tipo.b2b.hechas}/${OBJETIVO_ENTREVISTAS.b2b} a inmobiliarias o administradoras (con notas guardadas)`;
  if (r.completas) {
    return { estado: 'ok', detalle: `${base} · B2B que aceptarían pagar por un reporte de zona: ${r.b2b_aceptarian_pagar} de ${r.por_tipo.b2b.hechas} (criterio go/no-go: ≥2 de 5)` };
  }
  return { estado: 'fail', detalle: `${base} · faltan ${r.faltan.join(' y ')}: se registran en /admin/entrevistas` };
}

export async function ejecutar(conn: Conn, cfg: Config): Promise<Check[]> {
  const out: Check[] = [];
  const modos = (await conn.query('SELECT DISTINCT cd.modo FROM colonias z JOIN cargas_datos cd ON cd.id = z.carga_id')).map((x) => x.modo as string);
  const sintetico = modos.length === 1 && modos[0] === 'fixture';
  const svc = new ZonasService(enSerie(conn) as unknown as DatabaseService);

  const zonas = await conn.query(
    `SELECT c.id::text AS id, c.nombre, COALESCE(a.num_paradas,0)::int AS paradas, COALESCE(v.n_precio_m2,0)::int AS n_precio_m2, v.n_listados::int AS n_listados
     FROM colonias c LEFT JOIN zona_atributos a ON a.zona_id = c.id LEFT JOIN v_zona_precios v ON v.zona_id = c.id
     WHERE c.es_piloto ORDER BY c.nombre`);
  const masDatos = [...zonas].sort((a, b) => b.n_precio_m2 - a.n_precio_m2 || a.nombre.localeCompare(b.nombre)).slice(0, MAX_COMPARAR);

  // 1 ── búsqueda por nombre y filtros de renta y de transporte (RF-1.4)
  const problemas: string[] = [];
  const notas: string[] = [];
  if (!zonas.length) problemas.push('no hay zonas piloto cargadas (corre etl mvp2 y mvp3)');
  else {
    const z0 = zonas[0];
    const porNombre = await svc.listar(parseFiltrosZonas({ q: sinAcentos(z0.nombre).toUpperCase(), limit: '50' }));
    if (!porNombre.items.some((i: any) => i.id === z0.id)) problemas.push(`buscar «${z0.nombre}» sin acentos ni mayúsculas no la encuentra`);
    notas.push(`nombre: «${z0.nombre}» → ${porNombre.total} resultado(s)`);

    const rentas = (await conn.query(`SELECT renta_mediana::float AS r FROM v_zona_precios v JOIN colonias c ON c.id = v.zona_id WHERE c.es_piloto AND v.n_listados >= ${MIN_LISTADOS_ESTADISTICA}`)).map((x) => x.r as number);
    if (!rentas.length) problemas.push('ninguna zona tiene renta publicable para probar el filtro de renta');
    else {
      const minRenta = Math.floor(mediana(rentas));
      const r = await svc.listar(parseFiltrosZonas({ min_renta: String(minRenta), limit: '200' }));
      const mal = r.items.filter((i: any) => i.renta_mediana === null || i.renta_mediana < minRenta);
      if (!r.items.length || mal.length) problemas.push(`min_renta=${minRenta}: ${mal.length ? `${mal.length} zona(s) fuera del rango o suprimidas` : 'sin resultados'}`);
      notas.push(`renta ≥ $${minRenta}: ${r.total} zona(s)`);
    }

    const minParadas = Math.max(1, mediana(zonas.map((z) => z.paradas)));
    const t = await svc.listar(parseFiltrosZonas({ min_paradas: String(minParadas), limit: '200' }));
    const esperadas = zonas.filter((z) => z.paradas >= minParadas).length;
    if (!t.items.length || t.items.some((i: any) => i.num_paradas < minParadas) || t.total !== esperadas) {
      problemas.push(`min_paradas=${minParadas}: la API devolvió ${t.total} y el conteo manual es ${esperadas}`);
    }
    notas.push(`transporte ≥ ${minParadas} paradas: ${t.total} zona(s)`);

    const combo = await svc.listar(parseFiltrosZonas({ q: 'ageb', min_paradas: String(minParadas), limit: '200' }));
    if (combo.total > t.total) problemas.push('combinar texto y transporte devolvió más zonas que el filtro de transporte solo');
  }
  out.push({ id: 'busqueda_y_filtros', requisito: 'RF-1.4', descripcion: 'Búsqueda por nombre y filtros (renta, transporte)',
    estado: problemas.length ? 'fail' : 'ok', detalle: problemas.length ? problemas.join(' · ') : notas.join(' · ') });

  // 2 ── comparador de hasta 3 zonas (RF-1.4)
  const ids = masDatos.map((z) => z.id);
  let comp = '';
  let compOk = ids.length === MAX_COMPARAR;
  if (compOk) {
    try {
      const c = await svc.comparar(ids);
      const igualQueFicha: string[] = [];
      for (const it of c.items) {
        const f = await svc.detalle(it.id);
        if (f.renta.mediana !== it.renta_mediana || f.renta.precio_m2_mediano !== it.precio_m2_mediano) igualQueFicha.push(it.nombre);
      }
      compOk = c.items.length === MAX_COMPARAR && c.items.every((it: any, i: number) => it.id === ids[i] && !!it.geometry) && igualQueFicha.length === 0;
      comp = `${c.items.length} zonas en el orden pedido, con polígono · mismas cifras que la ficha${igualQueFicha.length ? ` ✘ (difieren: ${igualQueFicha.join(', ')})` : ''}`;
    } catch (e) {
      compOk = false;
      comp = `error al comparar: ${(e as Error).message}`;
    }
    let rechaza4 = false;
    try { parseIdsComparacion([...ids, '00000000-0000-4000-8000-000000000000'].join(',')); } catch { rechaza4 = true; }
    if (!rechaza4) { compOk = false; comp += ' · NO rechaza una cuarta zona'; } else comp += ` · rechaza la ${MAX_COMPARAR + 1}.ª zona`;
  } else comp = `se necesitan ${MAX_COMPARAR} zonas piloto para comparar y hay ${ids.length}`;
  out.push({ id: 'comparador_3_zonas', requisito: 'RF-1.4', descripcion: `Comparador de hasta ${MAX_COMPARAR} zonas`, estado: compOk ? 'ok' : 'fail', detalle: comp });

  // 3 ── comparador funcionando en producción (contra la URL pública)
  const base = (process.env.CIVITAS_URL ?? '').replace(/\/$/, '');
  if (!base) {
    out.push({ id: 'comparador_en_produccion', requisito: 'RF-1.4', descripcion: 'Comparador con 3 zonas funcionando en producción', estado: 'warn',
      detalle: 'No verificado en producción: define CIVITAS_URL (p. ej. https://civitas.mx) y vuelve a correr `etl mvp5`. Mientras tanto solo se comprobó contra la base local' });
  } else if (ids.length !== MAX_COMPARAR) {
    out.push({ id: 'comparador_en_produccion', requisito: 'RF-1.4', descripcion: 'Comparador con 3 zonas funcionando en producción', estado: 'fail', detalle: `faltan zonas piloto para probar ${base}` });
  } else {
    const api = (process.env.CIVITAS_API_URL ?? `${base}/api`).replace(/\/$/, '');
    const fallas: string[] = [];
    try {
      const a = await fetch(`${api}/zonas/comparar?items=${ids.join(',')}`, { signal: AbortSignal.timeout(15_000) });
      const j: any = a.ok ? await a.json() : null;
      if (!a.ok || j?.items?.length !== MAX_COMPARAR) fallas.push(`API ${api}/zonas/comparar → HTTP ${a.status}`);
      const w = await fetch(`${base}/comparar?items=${ids.join(',')}`, { signal: AbortSignal.timeout(15_000) });
      const html = w.ok ? await w.text() : '';
      const sinNombre = masDatos.filter((z) => !html.includes(z.nombre));
      if (!w.ok || sinNombre.length) fallas.push(`página ${base}/comparar → HTTP ${w.status}${sinNombre.length ? ` sin mostrar ${sinNombre.map((z) => z.nombre).join(', ')}` : ''}`);
    } catch (e) {
      fallas.push(`no se pudo conectar con ${base}: ${(e as Error).message}`);
    }
    out.push({ id: 'comparador_en_produccion', requisito: 'RF-1.4', descripcion: 'Comparador con 3 zonas funcionando en producción', estado: fallas.length ? 'fail' : 'ok',
      detalle: fallas.length ? fallas.join(' · ') : `${base}/comparar y ${api}/zonas/comparar responden con las 3 zonas` });
  }

  // 4 ── latencia de la búsqueda (RNF Latencia) y 5 ── 50 usuarios simulados (RNF Rendimiento): con un pool como el de la API
  const { svc: svcPool, cerrar } = servicioConPool(cfg.databaseUrl);
  try {
    const tiempos: number[] = [];
    const palabra = sinAcentos(zonas[0]?.nombre ?? 'ageb').split(/\s+/)[0].toLowerCase();
    for (let i = 0; i < 5; i++) {
      for (const accion of [
        () => svcPool.buscar(parseFiltrosZonas({ q: palabra }, 20, 8)),
        () => svcPool.listar(parseFiltrosZonas({ q: palabra, min_paradas: '1', orden: 'renta', limit: '12' })),
        () => (ids.length ? svcPool.comparar(ids) : Promise.resolve()),
      ]) {
        const t0 = performance.now();
        await accion();
        tiempos.push(performance.now() - t0);
      }
    }
    const lat = p95(tiempos);
    out.push({ id: 'latencia_busqueda', requisito: 'RNF-LAT', descripcion: `Búsqueda en <${LATENCIA_BUSQUEDA_MAX_MS / 1000} s`,
      estado: lat < LATENCIA_BUSQUEDA_MAX_MS ? (sintetico ? 'warn' : 'ok') : 'fail',
      detalle: `p95 ${lat.toFixed(0)} ms sobre autocompletar, búsqueda con filtros y comparación (consulta en el servidor, ${tiempos.length} mediciones)` +
        (sintetico ? ' · medido con datos SINTÉTICOS: el criterio habla de datos reales' : '') });

    const candidatos = zonas.length ? zonas : [];
    const ordenes = ['nombre', 'renta', 'precio_m2', 'comercios', 'paradas', 'listados'];
    const carga = await simularUsuarios(USUARIOS_SIMULADOS, async (i, medir) => {
      const z = candidatos[i % Math.max(1, candidatos.length)];
      const tres = ids.length === MAX_COMPARAR ? ids : [];
      const nombre = z ? sinAcentos(z.nombre).toLowerCase() : 'ageb';
      for (const k of [3, 5, nombre.length]) await medir(() => svcPool.buscar(parseFiltrosZonas({ q: nombre.slice(0, k) }, 20, 8)));   // escribe y autocompleta
      await medir(() => svcPool.listar(parseFiltrosZonas({ orden: ordenes[i % ordenes.length], min_paradas: String(i % 4), limit: '12' })));
      if (tres.length) await medir(() => svcPool.comparar(tres));
      if (z) await medir(() => svcPool.detalle(z.id));
    });
    const bien = carga.errores === 0 && carga.p95_ms < LATENCIA_BUSQUEDA_MAX_MS;
    out.push({ id: 'carga_50_usuarios', requisito: 'RNF-REND', descripcion: `Prueba con ${USUARIOS_SIMULADOS} usuarios simulados`,
      estado: bien ? (sintetico ? 'warn' : 'ok') : 'fail',
      detalle: `${carga.usuarios} usuarios a la vez · ${carga.solicitudes} solicitudes en ${carga.duracion_ms} ms (${carga.solicitudes_por_s}/s) · p50 ${carga.p50_ms} ms · p95 ${carga.p95_ms} ms · máx ${carga.max_ms} ms · ` +
        `${carga.errores} error(es)${carga.primer_error ? ` («${carga.primer_error.slice(0, 80)}»)` : ''} · la meta de la Fase 0 (miles de usuarios) no se verifica en el MVP` +
        (sintetico ? ' · datos SINTÉTICOS' : '') });
  } finally {
    await cerrar();
  }

  // 6 ── 5 entrevistas hechas y notas guardadas (negocio)
  const entrevistas = await conn.query('SELECT tipo, notas, acepta_pagar FROM entrevistas_precio');
  const e = evaluarEntrevistas(entrevistas as any);
  out.push({ id: 'entrevistas_5', requisito: 'NEGOCIO', descripcion: '5 entrevistas de precio hechas y notas guardadas (3 inquilinos, 2 B2B)', ...e });

  // 7 ── plan B listo si el lun 2 nov (Día de Muertos) se pierde
  const leido = existsSync(DOC_MVP5) ? readFileSync(DOC_MVP5, 'utf8') : null;
  out.push({ id: 'plan_b', requisito: 'PLAN-B', descripcion: 'Plan B listo si el lun 2 nov (Día de Muertos) se pierde',
    estado: leido === null ? 'warn' : /^## Plan B\b/m.test(leido) ? 'ok' : 'fail',
    detalle: leido === null ? 'No se encontró docs/mvp5/MVP5.md en este entorno: revisa la sección «Plan B» en el repositorio'
      : /^## Plan B\b/m.test(leido) ? 'La sección «Plan B» está escrita en docs/mvp5/MVP5.md' : 'Falta la sección «## Plan B» en docs/mvp5/MVP5.md' });

  // 8 ── aviso: datos sintéticos
  if (sintetico) {
    out.push({ id: 'datos_reales', requisito: 'AVISO', descripcion: 'Búsqueda y comparador con datos reales', estado: 'warn',
      detalle: 'La búsqueda y el comparador muestran zonas y listados SINTÉTICOS (modo fixture). Con datos reales: etl mvp2/mvp3 --fuente real' });
  }
  return out;
}

export async function guardar(conn: Conn, checks: Check[], modo: string): Promise<boolean> {
  const aprobada = checks.every((c) => c.estado !== 'fail');
  await conn.tx(() => conn.query('INSERT INTO mvp5_validaciones (aprobada, modo, resultados) VALUES ($1,$2,$3)', [aprobada, modo, JSON.stringify(checks)]));
  return aprobada;
}
