import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, fechaMX, mxn, num, pct, type Fuente, type ReporteCalidad, type Validacion } from '@/lib/api';
import TablaDatos, { type Columna, type Fila, type OpcionOrden } from '@/components/TablaDatos';
import { ETIQUETA_ROL, usuarioActual, type Rol } from '@/lib/sesion';

export const metadata = { title: 'Administración · CIVITAS' };

interface Resumen {
  usuarios_total: number; administradores: number; cuentas_demo: number; sesiones_activas: number;
  usuarios: { usuario: string; rol: Rol; proposito: string | null; es_demo: boolean; creado_en: string; ultimo_acceso: string | null }[];
}
const opcional = <T,>(p: Promise<T>) => p.catch(() => null);
const ICONO = { ok: '✔', fail: '✘', warn: '!' } as const;
const COLUMNAS_FUENTES: Columna[] = [
  { clave: 'nombre', etiqueta: 'Fuente', tipo: 'texto' },
  { clave: 'estado', etiqueta: 'Estado', tipo: 'texto' },
  { clave: 'modo', etiqueta: 'Modo', tipo: 'texto' },
  { clave: 'ultima_ingesta', etiqueta: 'Última ingesta', tipo: 'fecha' },
  { clave: 'registros_cargados', etiqueta: 'Cargados', tipo: 'entero' },
  { clave: 'registros_descartados', etiqueta: 'Descartados', tipo: 'entero' },
];
const OPCIONES_FUENTES: OpcionOrden[] = [
  { clave: 'reciente', etiqueta: 'Ingesta más reciente', columna: 'ultima_ingesta', dir: 'desc' },
  { clave: 'antigua', etiqueta: 'Ingesta más antigua', columna: 'ultima_ingesta', dir: 'asc' },
  { clave: 'cargados', etiqueta: 'Más registros cargados', columna: 'registros_cargados', dir: 'desc' },
  { clave: 'descartados', etiqueta: 'Más registros descartados', columna: 'registros_descartados', dir: 'desc' },
  { clave: 'nombre', etiqueta: 'Nombre (A–Z)', columna: 'nombre', dir: 'asc' },
];
const CAMPOS = { precio: 'Precio', superficie_m2: 'Superficie (m²)', recamaras: 'Recámaras', coordenadas: 'Coordenadas' } as const;

/** Checklist «Para pasar» de un MVP: criterios de aceptación ejecutados por el ETL (solo para quien desarrolla). */
function Checklist({ titulo, v, comando }: { titulo: string; v: Validacion | null; comando: string }) {
  return (
    <>
      <h2>{titulo} {v && <span className={`sello ${v.aprobada ? 'ok' : 'fail'}`}>{v.aprobada ? 'APROBADO' : 'NO APROBADO'}</span>}</h2>
      {v ? (
        <>
          <ul className="checklist">
            {v.resultados.map((c) => (
              <li key={c.id} className={c.estado}><span className="ico">{ICONO[c.estado]}</span>
                <div><strong>{c.requisito}</strong> {c.descripcion}<small>{c.detalle}</small></div></li>
            ))}
          </ul>
          <p className="nota">Validado el {fechaMX(v.ejecutada_en)}. Se actualiza con <code>{comando}</code>.</p>
        </>
      ) : <p className="nota">Aún no hay validación registrada (ejecuta <code>{comando}</code>).</p>}
    </>
  );
}

/** Reporte de calidad de la última carga de listados de renta (campos nulos, descartes y privacidad). */
function CalidadRenta({ rep }: { rep: ReporteCalidad }) {
  const c = rep.campos_clave;
  return (
    <>
      <h2>Calidad de los listados de renta (MVP-3)</h2>
      <p className="nota">Carga #{rep.carga_id} · archivo {rep.archivo_origen ?? 'n/d'} · generado el {fechaMX(rep.generado_en)}. Se evalúan todas las filas leídas,
        también las descartadas. Campos clave nulos: <strong>{pct(c.tasa_nulos)}</strong> (umbral &lt; {pct(rep.umbrales.max_tasa_nulos, 0)}, propuesto) ·
        {' '}{num(rep.totales.descartados)} filas descartadas de {num(rep.totales.leidos)} leídas.</p>
      <div className="dos-col">
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Campo clave</th><th className="n">Nulos o inválidos</th><th>% de leídas</th></tr></thead>
            <tbody>
              {(Object.keys(CAMPOS) as (keyof typeof CAMPOS)[]).map((k) => (
                <tr key={k}><td>{CAMPOS[k]}</td><td className="n">{num(c.por_campo[k].nulos)}</td>
                  <td><span className="barra" style={{ width: `${Math.min(100, c.por_campo[k].tasa * 100 * 8)}px` }} /> {pct(c.por_campo[k].tasa)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Motivo de descarte</th><th className="n">Filas</th></tr></thead>
            <tbody>
              {Object.entries(rep.descartes_por_motivo).map(([m, n]) => <tr key={m}><td>{m}</td><td className="n">{num(n)}</td></tr>)}
              {!Object.keys(rep.descartes_por_motivo).length && <tr><td colSpan={2}>Ninguno</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {rep.columnas_sensibles_ignoradas.length > 0 && (
        <p className="aviso-borrador"><strong>Privacidad:</strong> el archivo de origen trae columnas que no se leyeron ni se guardaron
          ({rep.columnas_sensibles_ignoradas.join(', ')}). Elimínalas del archivo.</p>
      )}
      <p className="nota">
        {rep.distribucion.precio_mxn && <>Renta mensual de la última carga: mediana {mxn(rep.distribucion.precio_mxn.mediana)} (p25 {mxn(rep.distribucion.precio_mxn.p25)} – p75 {mxn(rep.distribucion.precio_mxn.p75)}). </>}
        {num(rep.zonas.con_listados)} zonas con listados ({num(rep.zonas.piloto_con_listados)} de {num(rep.zonas.total_piloto)} zonas piloto).
      </p>
    </>
  );
}

/** P-10 (versión inicial): cuentas, fuentes de datos y estado de las validaciones. Solo rol administrador. */
export default async function Admin() {
  const sesion = await usuarioActual();
  if (!sesion) redirect('/iniciar-sesion?siguiente=/admin');
  if (sesion.cuenta.rol !== 'administrador') {
    return (
      <div className="prosa">
        <h1>Acceso restringido</h1>
        <p className="aviso-borrador">Tu cuenta (<strong>{sesion.cuenta.usuario}</strong>, {ETIQUETA_ROL[sesion.cuenta.rol].toLowerCase()}) no tiene permiso para el panel de administración.</p>
        <p><Link href="/mi-cuenta">Volver a mi cuenta</Link></p>
      </div>
    );
  }
  const [r, fuentes, v2, v3, v4, calidad] = await Promise.all([
    api<Resumen>('/admin/resumen', sesion.token),
    opcional(api<Fuente[]>('/datos-abiertos/fuentes')),
    opcional(api<Validacion>('/datos-abiertos/validacion')),
    opcional(api<Validacion>('/listados-renta/validacion')),
    opcional(api<Validacion>('/zonas/validacion')),
    opcional(api<ReporteCalidad>('/listados-renta/calidad')),
  ]);
  return (
    <div>
      <h1>Panel de administración</h1>
      <p><span className="sello ok">rol: administrador</span> sesión de <strong>{sesion.cuenta.usuario}</strong></p>
      {r.cuentas_demo > 0 && (
        <p className="aviso-borrador"><strong>Hay {r.cuentas_demo} cuentas de demostración activas</strong> (contraseñas triviales). Desactívalas antes de publicar: <code>DEMO_USERS=0</code>.</p>
      )}

      <section className="kpis">
        <div><b>{num(r.usuarios_total)}</b><span>cuentas ({num(r.administradores)} {r.administradores === 1 ? 'administradora' : 'administradoras'})</span></div>
        <div><b>{num(r.sesiones_activas)}</b><span>sesiones activas</span></div>
        <div><b>{[v2, v3, v4].map((v) => (v ? (v.aprobada ? 'OK' : 'NO') : '—')).join(' · ')}</b><span>validación MVP-2 · MVP-3 · MVP-4</span></div>
      </section>

      <h2>Fuentes de datos (trazabilidad)</h2>
      {fuentes ? (
        <TablaDatos columnas={COLUMNAS_FUENTES} idFila="clave" buscar={['nombre', 'clave', 'estado', 'modo']} opciones={OPCIONES_FUENTES} ordenInicial="reciente"
          unidad={['fuente', 'fuentes']} placeholder="fuente, estado o modo"
          filas={fuentes.map((f): Fila => ({ clave: f.clave, nombre: f.nombre, estado: f.estado, modo: f.modo, ultima_ingesta: f.ultima_ingesta,
            registros_cargados: f.registros_cargados, registros_descartados: f.registros_descartados }))} />
      ) : <p className="aviso-borrador">No se pudo consultar el catálogo de fuentes.</p>}
      <p className="nota">Vista pública: <Link href="/zonas">Zonas piloto</Link> · <Link href="/rentas">Precios de renta</Link> · <Link href="/colonias">Catálogo</Link></p>

      {calidad && <CalidadRenta rep={calidad} />}
      <Checklist titulo="Checklist de MVP-4 (catálogo y recaptura)" v={v4} comando="docker compose run --rm etl mvp4" />

      <h2>Cuentas</h2>
      <p className="nota">Por privacidad el panel no muestra correos ni contraseñas.</p>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Uso previsto</th><th>Creada</th><th>Último acceso</th></tr></thead>
          <tbody>
            {r.usuarios.map((u) => (
              <tr key={u.usuario}><td>{u.usuario} {u.es_demo && <span className="sello warn">demo</span>}</td><td>{ETIQUETA_ROL[u.rol]}</td>
                <td>{u.proposito ?? '—'}</td><td>{fechaMX(u.creado_en)}</td><td>{fechaMX(u.ultimo_acceso)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
