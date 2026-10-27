import Link from 'next/link';
import {
  api, fechaMX, mxn, num, pct,
  type ListaListados, type ReporteCalidad, type ResumenZonasRenta, type Validacion,
} from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rentas · CIVITAS' };

const ICONO = { ok: '✔', fail: '✘', warn: '!' } as const;
const CAMPOS = { precio: 'Precio', superficie_m2: 'Superficie (m²)', recamaras: 'Recámaras', coordenadas: 'Coordenadas' } as const;

export default async function Rentas() {
  let rep: ReporteCalidad, val: Validacion, zonas: ResumenZonasRenta, muestra: ListaListados;
  try {
    [rep, val, zonas, muestra] = await Promise.all([
      api<ReporteCalidad>('/listados-renta/calidad'),
      api<Validacion>('/listados-renta/validacion'),
      api<ResumenZonasRenta>('/listados-renta/resumen-zonas?limit=60'),
      api<ListaListados>('/listados-renta?limit=15&orden=reciente'),
    ]);
  } catch (e) {
    return (
      <div>
        <h1>Rentas</h1>
        <p className="aviso-borrador">No hay datos de rentas todavía o la API no responde ({(e as Error).message}). Carga las zonas
          (<code>docker compose run --rm etl mvp2</code>) y luego los listados (<code>docker compose run --rm etl mvp3</code>).</p>
      </div>
    );
  }

  const sintetico = rep.modo === 'fixture';
  const c = rep.campos_clave;
  const umbral = rep.umbrales.max_tasa_nulos;

  return (
    <div className="ancho">
      <h1>MVP-3 · Precios de renta</h1>
      {sintetico && (
        <p className="aviso-borrador"><strong>Datos sintéticos.</strong> Estos listados de renta son datos de prueba generados para validar
          el pipeline; no son precios reales ni provienen de ningún portal.</p>
      )}

      <section className="kpis">
        <div><b>{num(rep.totales.acumulado.con_zona)}</b><span>listados de renta con zona asignada (mínimo {num(rep.umbrales.min_listados_con_zona)})</span></div>
        <div><b>{pct(c.tasa_nulos)}</b><span>con algún campo clave nulo (umbral &lt; {pct(umbral, 0)}, propuesto)</span></div>
        <div><b>{num(rep.totales.descartados)}</b><span>filas descartadas de {num(rep.totales.leidos)} leídas</span></div>
      </section>

      <h2>Para pasar <span className={`sello ${val.aprobada ? 'ok' : 'fail'}`}>{val.aprobada ? 'APROBADO' : 'NO APROBADO'}</span></h2>
      <ul className="checklist">
        {val.resultados.map((r) => (
          <li key={r.id} className={r.estado}><span className="ico">{ICONO[r.estado]}</span>
            <div><strong>{r.requisito}</strong> {r.descripcion}<small>{r.detalle}</small></div></li>
        ))}
      </ul>
      <p className="nota">Validado el {fechaMX(val.ejecutada_en)}.</p>

      <h2>Reporte de calidad</h2>
      <p className="nota">Carga #{rep.carga_id} · archivo {rep.archivo_origen ?? 'n/d'} · generado el {fechaMX(rep.generado_en)}. Se evalúan todas las
        filas leídas, también las descartadas.</p>
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
        {rep.distribucion.precio_mxn && <>Renta mensual: mediana {mxn(rep.distribucion.precio_mxn.mediana)} (p25 {mxn(rep.distribucion.precio_mxn.p25)} – p75 {mxn(rep.distribucion.precio_mxn.p75)}). </>}
        {num(rep.zonas.con_listados)} zonas con listados ({num(rep.zonas.piloto_con_listados)} de {num(rep.zonas.total_piloto)} zonas piloto).
      </p>

      <h2>Renta por zona</h2>
      <p className="nota">Las zonas con menos de {zonas.min_listados_estadistica} listados se muestran sin estadísticas: con tan pocos anuncios la mediana no es fiable.</p>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Zona</th><th className="n">Listados</th><th className="n">Renta mediana</th><th className="n">p25</th><th className="n">p75</th><th className="n">MXN/m² mediano</th></tr></thead>
          <tbody>
            {zonas.items.map((z) => (
              <tr key={z.zona_id}><td><Link href={`/colonias/${z.zona_id}`}>{z.nombre}</Link></td><td className="n">{num(z.n_listados)}</td>
                {z.estadistica_suprimida
                  ? <td colSpan={4} className="suprimida">menos de {zonas.min_listados_estadistica} listados</td>
                  : <><td className="n">{mxn(z.renta_mediana)}</td><td className="n">{mxn(z.renta_p25)}</td><td className="n">{mxn(z.renta_p75)}</td><td className="n">{mxn(z.precio_m2_mediano)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Muestra de listados</h2>
      <p className="nota">Los más recientes de {num(muestra.total)} listados. Cada fila es un inmueble: no hay teléfonos ni nombres de anunciantes.</p>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Anuncio</th><th>Tipo</th><th className="n">Renta</th><th className="n">m²</th><th className="n">Rec.</th><th>Zona</th><th>Publicado</th></tr></thead>
          <tbody>
            {muestra.items.map((l) => (
              <tr key={l.id}><td><code>{l.id_fuente}</code></td><td>{l.tipo_inmueble}</td><td className="n">{mxn(l.precio_mxn)}</td>
                <td className="n">{num(l.superficie_m2, 0)}</td><td className="n">{l.recamaras ?? '—'}</td>
                <td>{l.zona_id ? <Link href={`/colonias/${l.zona_id}`}>{l.zona_nombre}</Link> : <span className="suprimida">sin zona</span>}</td><td>{l.publicado_en ?? '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
