/** Checklist "PARA PASAR" de MVP-4 como código ejecutable (ver docs/mvp4/MVP4.md). */
import { Config } from '../config';
import { Conn } from '../db';
import { Check } from '../validacion';
import { DatabaseService } from '../../database/database.service';
import { MIN_LISTADOS_ESTADISTICA } from '../../renta/filtros-renta';
import { parseFiltrosZonas } from '../../zonas/filtros-zonas';
import { ZonasService } from '../../zonas/zonas.service';

export const LATENCIA_MAX_MS = 3000; // umbral propuesto (RNF Latencia: «lista y ficha en <3 s con datos reales»)
export const ZONAS_A_VERIFICAR = 3;  // «la mediana por m² coincide con un cálculo manual en 3 zonas»

const lista = (xs: string[]) => (xs.length ? `[${xs.map((x) => `'${x}'`).join(', ')}]` : 'ninguna');

/** Mediana «a mano»: se ordena y se promedia el centro (percentile_cont con interpolación lineal da lo mismo). */
export function medianaManual(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.95) - 1)] ?? 0;

/** El servicio usa un pool y lanza consultas en paralelo; el ETL tiene un solo cliente, que no admite consultas simultáneas: se encolan. */
function enSerie(conn: Conn) {
  let cola: Promise<unknown> = Promise.resolve();
  return {
    query: <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const r = cola.then(() => conn.query(sql, params));
      cola = r.catch(() => undefined);
      return r as Promise<T[]>;
    },
  };
}

export async function ejecutar(conn: Conn, cfg: Config): Promise<Check[]> {
  const out: Check[] = [];
  const svc = new ZonasService(enSerie(conn) as unknown as DatabaseService);
  const modos = (await conn.query('SELECT DISTINCT cd.modo FROM colonias z JOIN cargas_datos cd ON cd.id = z.carga_id')).map((x) => x.modo as string);
  const sintetico = modos.length === 1 && modos[0] === 'fixture';

  // 1 ── demo: mapa + ficha en las 30 zonas (RF-1.1)
  const pilotos = await conn.query('SELECT id FROM colonias WHERE es_piloto ORDER BY nombre');
  const fichas: { ms: number; ok: boolean; conMediana: boolean; geom: boolean }[] = [];
  for (const z of pilotos) {
    const t0 = performance.now();
    try {
      const f = await svc.detalle(z.id);
      fichas.push({ ms: performance.now() - t0, ok: true, conMediana: f.renta.precio_m2_mediano !== null, geom: !!f.geometry });
    } catch {
      fichas.push({ ms: performance.now() - t0, ok: false, conMediana: false, geom: false });
    }
  }
  const mapa = await svc.geojson(parseFiltrosZonas({}, 500, 500));
  const buenas = fichas.filter((f) => f.ok && f.geom).length;
  out.push({ id: 'mapa_y_ficha_30_zonas', requisito: 'RF-1.1', descripcion: `Mapa + ficha en las ${cfg.zonasPiloto} zonas piloto`,
    estado: pilotos.length >= cfg.zonasPiloto && buenas === pilotos.length && mapa.features.length === pilotos.length ? 'ok' : 'fail',
    detalle: `${buenas}/${pilotos.length} fichas con polígono · ${mapa.features.length} zonas en el mapa · ` +
      `${fichas.filter((f) => f.conMediana).length} con mediana por m² publicable y ${fichas.filter((f) => f.ok && !f.conMediana).length} suprimidas (<${MIN_LISTADOS_ESTADISTICA} datos)` });

  // 2 ── la mediana por m² coincide con un cálculo manual en 3 zonas (RF-1.1)
  const candidatas = await conn.query(
    'SELECT zona_id FROM v_zona_precios WHERE n_precio_m2 >= $1 ORDER BY n_precio_m2 DESC, zona_id LIMIT $2', [MIN_LISTADOS_ESTADISTICA, ZONAS_A_VERIFICAR]);
  const comp: string[] = [];
  let todas = candidatas.length === ZONAS_A_VERIFICAR;
  for (const c of candidatas) {
    const f = await svc.detalle(c.zona_id);
    const m2 = (await conn.query('SELECT precio_m2::float AS v FROM listados_renta WHERE zona_id = $1 AND precio_m2 IS NOT NULL', [c.zona_id])).map((r) => r.v as number);
    const renta = (await conn.query('SELECT precio_mxn::float AS v FROM listados_renta WHERE zona_id = $1', [c.zona_id])).map((r) => r.v as number);
    const [man, manR] = [medianaManual(m2), medianaManual(renta)];
    const ok = man !== null && manR !== null && f.renta.precio_m2_mediano !== null && f.renta.mediana !== null &&
      Math.abs(f.renta.precio_m2_mediano - man) < 0.01 && Math.abs(f.renta.mediana - manR) < 0.01;
    if (!ok) todas = false;
    comp.push(`${f.nombre}: API $${f.renta.precio_m2_mediano?.toFixed(2)}/m² vs manual $${man?.toFixed(2)}/m² (n=${m2.length})${ok ? '' : ' ✘'}`);
  }
  out.push({ id: 'mediana_m2_manual', requisito: 'RF-1.1', descripcion: `La mediana por m² coincide con un cálculo manual en ${ZONAS_A_VERIFICAR} zonas`,
    estado: todas ? 'ok' : 'fail', detalle: comp.length ? comp.join(' · ') : `no hay ${ZONAS_A_VERIFICAR} zonas con ≥${MIN_LISTADOS_ESTADISTICA} datos de m² para comparar` });

  // 3 ── primera recaptura automática ejecutada (RF-1.3 parcial)
  const rec = await conn.query(
    "SELECT id, estado, comando, finalizada_en, registros_leidos, registros_cargados FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'ok' ORDER BY id DESC");
  const programada = rec.find((r) => String(r.comando).includes('programada'));
  out.push({ id: 'recaptura_ejecutada', requisito: 'RF-1.3', descripcion: 'Primera recaptura automática ejecutada',
    estado: programada ? 'ok' : rec.length ? 'warn' : 'fail',
    detalle: programada ? `carga #${programada.id} (programada) · leídos=${programada.registros_leidos} cargados=${programada.registros_cargados} · ${rec.length} recaptura(s) ok en total`
      : rec.length ? `solo hay recapturas manuales (${rec.length}); la programada (servicio recaptura) aún no corrió`
      : 'ninguna recaptura registrada: corre `etl recaptura` (una vez) o levanta el servicio `recaptura`' });

  // 4 ── el cron registra sus fallos (RNF Disponibilidad)
  const fallos = await conn.query("SELECT id, error, iniciada_en FROM cargas_datos WHERE comando LIKE '%recaptura%' AND estado = 'error' ORDER BY id DESC");
  out.push({ id: 'cron_registra_fallos', requisito: 'RNF-DISP', descripcion: 'El cron registra sus fallos',
    estado: fallos.length ? 'ok' : 'warn',
    detalle: fallos.length ? `${fallos.length} fallo(s) registrado(s) · último: carga #${fallos[0].id} «${String(fallos[0].error).slice(0, 80)}»`
      : 'ninguna recaptura ha fallado todavía; el registro de fallos lo cubre la suite (test/mvp4/recaptura.spec.ts)' });

  // 5 ── latencia de la lista y la ficha (RNF Latencia)
  const lista_ms: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await svc.listar(parseFiltrosZonas({ orden: 'renta', limit: '50' }));
    lista_ms.push(performance.now() - t0);
  }
  const [pl, pf] = [p95(lista_ms), p95(fichas.map((f) => f.ms))];
  out.push({ id: 'latencia', requisito: 'RNF-LAT', descripcion: `Lista y ficha en <${LATENCIA_MAX_MS / 1000} s`,
    estado: pl < LATENCIA_MAX_MS && pf < LATENCIA_MAX_MS ? (sintetico ? 'warn' : 'ok') : 'fail',
    detalle: `lista p95 ${pl.toFixed(0)} ms · ficha p95 ${pf.toFixed(0)} ms (consulta en el servidor, ${pilotos.length} fichas)` +
      (sintetico ? ' · medido con datos SINTÉTICOS: el criterio habla de datos reales' : '') });

  // 6 ── aviso: datos sintéticos
  if (sintetico) {
    out.push({ id: 'datos_reales', requisito: 'AVISO', descripcion: 'Catálogo con datos reales', estado: 'warn',
      detalle: 'El catálogo muestra zonas y listados SINTÉTICOS (modo fixture). Con datos reales: etl mvp2/mvp3 --fuente real' });
  }
  return out;
}

export async function guardar(conn: Conn, checks: Check[], modo: string): Promise<boolean> {
  const aprobada = checks.every((c) => c.estado !== 'fail');
  await conn.tx(() => conn.query('INSERT INTO mvp4_validaciones (aprobada, modo, resultados) VALUES ($1,$2,$3)', [aprobada, modo, JSON.stringify(checks)]));
  return aprobada;
}

export async function modoDeDatos(conn: Conn): Promise<string> {
  const m = (await conn.query('SELECT DISTINCT cd.modo FROM colonias z JOIN cargas_datos cd ON cd.id = z.carga_id')).map((x) => x.modo as string);
  return m.length === 1 ? m[0] : 'n/d';
}
