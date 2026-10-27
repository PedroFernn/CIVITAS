import Link from 'next/link';
import { notFound } from 'next/navigation';
import MiniMapa from '@/components/MiniMapa';
import { API_URL, fechaMX, num } from '@/lib/api';
import { entero, mxn2, mxnC, type FeatureCatalogo, type FichaZona } from '@/lib/zonas';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ficha(id: string): Promise<FichaZona | null> {
  if (!UUID.test(id)) return null;
  const r = await fetch(`${API_URL}/zonas/${id}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/zonas/${id} → HTTP ${r.status}`);
  return r.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const f = await ficha((await params).id).catch(() => null);
  return { title: f ? `${f.nombre} · CIVITAS` : 'Zona · CIVITAS' };
}

/** Diferencia porcentual de la zona contra la ciudad, con signo ("+12 %"). */
const dif = (z: number | null, c: number | null) => (z === null || !c ? null : ((z - c) / c) * 100);
const fmtDif = (d: number | null) => (d === null ? '—' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('es-MX', { maximumFractionDigits: 0 })} %`);
const TIPOS: Record<string, string> = { departamento: 'Departamentos', casa: 'Casas', cuarto: 'Cuartos', otro: 'Otros' };

/** P-03 · Ficha de zona: precio mediano por m², comparación con la ciudad, minimapa y listados recientes (anónimos). */
export default async function FichaZonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let f: FichaZona | null;
  try { f = await ficha(id); } catch (e) {
    return <div><h1>Zona</h1><p className="aviso-borrador">No se pudo contactar la API ({(e as Error).message}). <Link href="/colonias">Volver al catálogo</Link></p></div>;
  }
  if (!f) notFound();

  const r = f.renta, c = f.ciudad_referencia, t = f.trazabilidad;
  const feature: FeatureCatalogo = { type: 'Feature', id: f.id, properties: f, geometry: f.geometry };
  const sintetico = t.modo_datos === 'fixture';
  const dRenta = dif(r.mediana, c?.renta_mediana ?? null), dM2 = dif(r.precio_m2_mediano, c?.precio_m2_mediano ?? null);
  const ancho = (v: number | null) => (v !== null && r.p75 ? `${Math.max(2, Math.min(100, (v / (r.p75 * 1.15)) * 100))}%` : '0%');

  return (
    <div className="ancho ficha-zona">
      <nav className="migas" aria-label="Ruta"><Link href="/colonias">Catálogo</Link> › {f.ciudad} › <span aria-current="page">{f.nombre}</span></nav>
      <h1>{f.nombre}</h1>
      <p className="nota">
        {f.tipo_unidad.toUpperCase()} <code>{f.clave_geo ?? 's/clave'}</code> · {f.ciudad}{f.area_km2 !== null && <> · {num(f.area_km2, 2)} km²</>}
        {t.precios_actualizados_en && <> · precios actualizados el {fechaMX(t.precios_actualizados_en)}</>}
      </p>
      {sintetico && (
        <p className="aviso-borrador"><strong>Datos sintéticos.</strong> Esta zona y sus precios son de prueba (modo fixture): sirven para validar el catálogo, no describen el mercado real.</p>
      )}

      {r.estadistica_suprimida ? (
        <p className="aviso-borrador"><strong>Sin estadística de precios.</strong> Esta zona tiene {r.n_listados} {r.n_listados === 1 ? 'listado' : 'listados'}; la mediana se publica con {r.min_listados_estadistica} o más
          (con menos, no es fiable y casi identifica la oferta).</p>
      ) : (
        <section className="kpis" aria-label="Precios">
          <div><b>{mxnC(r.mediana)}</b><span>renta mediana mensual · {num(r.n_listados)} listados</span>
            <small className={dRenta !== null && dRenta > 0 ? 'sube' : 'baja'}>{fmtDif(dRenta)} vs. la ciudad</small></div>
          <div><b>{r.precio_m2_mediano !== null ? mxn2(r.precio_m2_mediano) : '—'}</b><span>renta mediana por m²</span>
            {r.precio_m2_mediano !== null
              ? <small className={dM2 !== null && dM2 > 0 ? 'sube' : 'baja'}>{fmtDif(dM2)} vs. la ciudad{r.posicion_precio_m2 && <> · lugar {r.posicion_precio_m2.lugar} de {r.posicion_precio_m2.de}</>}</small>
              : <small>menos de {r.min_listados_estadistica} listados con superficie</small>}</div>
          <div><b>{mxnC(r.p25)} – {mxnC(r.p75)}</b><span>rango intercuartil (p25 – p75)</span>
            <span className="rango" aria-hidden="true"><i style={{ left: ancho(r.p25), width: `calc(${ancho(r.p75)} - ${ancho(r.p25)})` }} /><u style={{ left: ancho(r.mediana) }} /></span></div>
        </section>
      )}

      <div className="ficha-cols">
        <div>
          <h2>Indicadores</h2>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Indicador</th><th className="n">Zona</th><th className="n">Ciudad</th><th>Fuente</th></tr></thead>
              <tbody>
                <tr><td>Renta mediana</td><td className="n">{mxnC(r.mediana)}</td><td className="n">{mxnC(c?.renta_mediana)}</td><td>Listados de renta (captura manual)</td></tr>
                <tr><td>Renta por m² (mediana)</td><td className="n">{mxn2(r.precio_m2_mediano)}</td><td className="n">{mxn2(c?.precio_m2_mediano)}</td><td>Listados de renta (captura manual)</td></tr>
                <tr><td>Listados</td><td className="n">{entero(r.n_listados)}</td><td className="n">{entero(c?.n_listados)}</td><td>Listados de renta</td></tr>
                <tr><td>Comercios</td><td className="n">{entero(f.num_comercios)}</td><td className="n">—</td><td>INEGI · DENUE (SCIAN 43/46)</td></tr>
                <tr><td>Comercios por km²</td><td className="n">{num(f.densidad_comercios_km2, 0)}</td><td className="n">—</td><td>INEGI · DENUE y MGN</td></tr>
                <tr><td>Paradas de transporte</td><td className="n">{entero(f.num_paradas)}</td><td className="n">—</td><td>Transporte público (GTFS)</td></tr>
              </tbody>
            </table>
          </div>

          {r.por_tipo.length > 0 && (
            <>
              <h2>Por tipo de inmueble</h2>
              <div className="tabla-scroll">
                <table>
                  <thead><tr><th>Tipo</th><th className="n">Listados</th><th className="n">Renta mediana</th><th className="n">Por m²</th></tr></thead>
                  <tbody>
                    {r.por_tipo.map((p) => (
                      <tr key={p.tipo}><td>{TIPOS[p.tipo] ?? p.tipo}</td><td className="n">{entero(p.n)}</td>
                        <td className="n">{p.renta_mediana !== null ? mxnC(p.renta_mediana) : <span className="suprimida">&lt;{r.min_listados_estadistica}</span>}</td>
                        <td className="n">{p.precio_m2_mediano !== null ? mxn2(p.precio_m2_mediano) : <span className="suprimida">&lt;{r.min_listados_estadistica}</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <aside>
          <h2>Ubicación</h2>
          <MiniMapa feature={feature} />
          <p className="nota">Contorno de la zona{sintetico ? ' (sintético: no es el límite real)' : ''}.</p>
        </aside>
      </div>

      <h2>Listados recientes en la zona</h2>
      {f.listados_recientes.length === 0 ? <p className="nota">Esta zona aún no tiene listados.</p> : (
        <ul className="inmuebles">
          {f.listados_recientes.map((l) => (
            <li key={l.id}>
              <span className="inm-tipo">{TIPOS[l.tipo_inmueble]?.replace(/s$/, '') ?? l.tipo_inmueble}</span>
              <b>{mxnC(l.precio_mxn)}</b><small>/mes</small>
              <span>{l.superficie_m2 !== null ? `${entero(l.superficie_m2)} m²` : 'superficie n/d'} · {l.recamaras === null ? 'rec. n/d' : l.recamaras === 0 ? 'estudio' : `${l.recamaras} rec.`}</span>
              <small>{l.publicado_en ?? 'sin fecha'}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="nota">Cada tarjeta es un inmueble, sin enlace al anuncio ni datos del anunciante. El detalle por inmueble y las señales de anomalía llegan en hitos posteriores.</p>

      <h2>Trazabilidad</h2>
      <dl className="ficha">
        <dt>Polígono</dt><dd>{t.fuente_geom ?? '—'} · {t.modo_datos === 'fixture' ? 'sintético' : t.modo_datos ?? '—'} · cargado el {fechaMX(t.fecha_carga)}</dd>
        <dt>Precios actualizados</dt><dd>{fechaMX(t.precios_actualizados_en)}</dd>
        <dt>Última recaptura</dt><dd>{t.ultima_recaptura_en ? fechaMX(t.ultima_recaptura_en) : 'ninguna registrada todavía'}</dd>
      </dl>
      <p className="nota"><Link href="/colonias">← Volver al catálogo</Link> · <Link href="/zonas">Datos de las zonas piloto</Link> · <Link href="/rentas">Calidad de los datos de renta</Link></p>
    </div>
  );
}
