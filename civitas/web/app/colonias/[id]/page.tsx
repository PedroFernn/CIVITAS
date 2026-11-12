import Link from 'next/link';
import { notFound } from 'next/navigation';
import AvisoDatos from '@/components/AvisoDatos';
import MiniMapa from '@/components/MiniMapa';
import Etiqueta from '@/components/Etiqueta';
import Termino from '@/components/Termino';
import { API_URL, fechaMX, num } from '@/lib/api';
import { modosDatos } from '@/lib/modo';
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
  const modos = await modosDatos();
  const conBase = t.modo_datos === 'real';
  const fuentePrecios = modos.precios === 'fixture' ? 'Precios de demostración' : 'Anuncios de renta';
  const dRenta = dif(r.mediana, c?.renta_mediana ?? null), dM2 = dif(r.precio_m2_mediano, c?.precio_m2_mediano ?? null);
  const ref = c?.ciudad ?? 'la ciudad';
  const refCorta = c?.ambito === 'estado' ? 'todo el estado' : c?.ciudad ?? 'la ciudad';
  const lectura = (() => {
    if (r.estadistica_suprimida) return `Todavía hay pocos anuncios en esta zona para dar una cifra confiable.`;
    const partes: string[] = [];
    if (r.mediana !== null) {
      const d = dRenta;
      const cmp = d === null ? '' : Math.abs(d) < 2 ? `, casi igual que el promedio de ${ref}` : `, ${fmtDif(d).replace('−', '').replace('+', '')} ${d > 0 ? 'más caro' : 'más barato'} que el promedio de ${ref}`;
      partes.push(`Rentar aquí cuesta normalmente ${mxnC(r.mediana)} al mes${cmp}.`);
    }
    const pos = r.posicion_precio_m2;
    if (pos) partes.push(`Por metro cuadrado es la zona n.º ${pos.lugar} más cara de ${pos.de} en ${pos.ambito === 'estado' ? 'todo el estado' : f.ciudad}.`);
    const gente = f.poblacion !== null ? `Viven aquí unas ${entero(f.poblacion)} personas, y hay ` : 'Hay ';
    partes.push(`${gente}${entero(f.num_comercios)} comercios y ${entero(f.num_paradas)} paradas de transporte cerca.`);
    const raras = r.anomalias.inflados + r.anomalias.subprecio;
    if (raras > 0) partes.push(`${raras === 1 ? '1 anuncio' : `${raras} anuncios`} de la zona ${raras === 1 ? 'tiene' : 'tienen'} un precio muy fuera de lo normal.`);
    return partes.join(' ');
  })();
  const ancho = (v: number | null) => (v !== null && r.p75 ? `${Math.max(2, Math.min(100, (v / (r.p75 * 1.15)) * 100))}%` : '0%');

  return (
    <div className="ancho ficha-zona">
      <nav className="migas" aria-label="Ruta"><Link href="/colonias">Explorar zonas</Link> › <Link href={`/colonias?municipio=${encodeURIComponent(f.ciudad)}`}>{f.ciudad}</Link> › <span aria-current="page">{f.nombre}</span></nav>
      <h1>{f.nombre}</h1>
      <p><Link className="enlace-sec" href={`/comparar?items=${f.id}`}>Comparar con otras zonas</Link></p>
      <p className="nota">
        {f.ciudad}{f.localidad && f.localidad !== f.ciudad ? `, ${f.localidad}` : ''}{f.area_km2 !== null && <> · {num(f.area_km2, 2)} km²</>}
        {t.precios_actualizados_en && <> · precios actualizados el {fechaMX(t.precios_actualizados_en)}</>}
      </p>
      <p className="lectura" role="note">{lectura}</p>
      <AvisoDatos modos={modos} />

      {r.estadistica_suprimida ? (
        <p className="aviso-borrador"><strong>Sin estadística de precios.</strong> Esta zona tiene {r.n_listados} {r.n_listados === 1 ? 'anuncio' : 'anuncios'}; la renta típica se publica con {r.min_listados_estadistica} o más
          (con menos, la cifra no es fiable y casi permitiría identificar un anuncio).</p>
      ) : (
        <section className="kpis" aria-label="Precios">
          <div><b>{mxnC(r.mediana)}</b><span><Termino k="mediana" /> al mes · {num(r.n_listados)} anuncios</span>
            <small className={dRenta !== null && dRenta > 0 ? 'sube' : 'baja'}>{fmtDif(dRenta)} frente a {ref}</small></div>
          <div><b>{r.precio_m2_mediano !== null ? mxn2(r.precio_m2_mediano) : '—'}</b><span><Termino k="m2" /> (típica)</span>
            {r.precio_m2_mediano !== null
              ? <small className={dM2 !== null && dM2 > 0 ? 'sube' : 'baja'}>{fmtDif(dM2)} frente a {ref}{r.posicion_precio_m2 && <> · lugar {r.posicion_precio_m2.lugar} de {r.posicion_precio_m2.de} en {refCorta} (1 = la más cara)</>}</small>
              : <small>menos de {r.min_listados_estadistica} anuncios con superficie</small>}</div>
          <div><b>{mxnC(r.p25)} – {mxnC(r.p75)}</b><span><Termino k="rango" /></span>
            <span className="rango" aria-hidden="true"><i style={{ left: ancho(r.p25), width: `calc(${ancho(r.p75)} - ${ancho(r.p25)})` }} /><u style={{ left: ancho(r.mediana) }} /></span></div>
        </section>
      )}

      <section aria-labelledby="h-gente">
        <h2 id="h-gente">Quién vive aquí</h2>
        {f.poblacion === null ? (
          <p className="nota">El INEGI no publica la población de esta zona (la reserva por confidencialidad cuando hay muy pocas personas).</p>
        ) : (
          <div className="kpis kpis-chicos">
            <div><b>{entero(f.poblacion)}</b><span><Termino k="poblacion" /></span></div>
            <div><b>{entero(f.viviendas)}</b><span><Termino k="viviendas" /></span></div>
            <div><b>{f.densidad_hab_km2 === null ? '—' : entero(f.densidad_hab_km2)}</b><span><Termino k="densidadHab" /></span></div>
            <div><b>{f.comercios_por_1000_hab === null ? '—' : num(f.comercios_por_1000_hab, 1)}</b><span><Termino k="comerciosMil" /></span></div>
          </div>
        )}
        {f.municipio && (
          <p className="nota">Esta zona es una de las {num(f.municipio.n_zonas)} zonas urbanas de <Link href={`/colonias?municipio=${encodeURIComponent(f.municipio.nombre)}`}>{f.municipio.nombre}</Link>
            {f.municipio.poblacion !== null && <>, un municipio de {num(f.municipio.poblacion)} habitantes</>}. Fuente: Censo de Población y Vivienda 2020, INEGI.</p>
        )}
      </section>

      <div className="ficha-cols">
        <div>
          <h2>Los números, uno por uno</h2>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Indicador</th><th className="n">Esta zona</th><th className="n">Promedio de {refCorta}</th><th>De dónde sale</th></tr></thead>
              <tbody>
                <tr><td><Termino k="mediana" /></td><td className="n">{mxnC(r.mediana)}</td><td className="n">{mxnC(c?.renta_mediana)}</td><td>{fuentePrecios}</td></tr>
                <tr><td><Termino k="m2" /></td><td className="n">{mxn2(r.precio_m2_mediano)}</td><td className="n">{mxn2(c?.precio_m2_mediano)}</td><td>{fuentePrecios}</td></tr>
                <tr><td><Termino k="listados" /></td><td className="n">{entero(r.n_listados)}</td><td className="n">{entero(c?.n_listados)}</td><td>{fuentePrecios}</td></tr>
                <tr><td><Termino k="comercios" /></td><td className="n">{entero(f.num_comercios)}</td><td className="n">—</td><td>INEGI · DENUE (SCIAN 43/46)</td></tr>
                <tr><td><Termino k="densidad" /></td><td className="n">{num(f.densidad_comercios_km2, 0)}</td><td className="n">—</td><td>INEGI · DENUE y MGN</td></tr>
                <tr><td><Termino k="paradas" /></td><td className="n">{entero(f.num_paradas)}</td><td className="n">—</td><td>OpenStreetMap (paradas de bus)</td></tr>
                <tr><td><Termino k="poblacion" /></td><td className="n">{entero(f.poblacion)}</td><td className="n">—</td><td>INEGI · Censo 2020</td></tr>
                <tr><td><Termino k="comerciosMil" /></td><td className="n">{f.comercios_por_1000_hab === null ? '—' : num(f.comercios_por_1000_hab, 1)}</td><td className="n">—</td><td>INEGI · DENUE y Censo 2020</td></tr>
              </tbody>
            </table>
          </div>

          {r.por_tipo.length > 0 && (
            <>
              <h2>Según el tipo de inmueble</h2>
              <div className="tabla-scroll">
                <table>
                  <thead><tr><th>Tipo</th><th className="n">Anuncios</th><th className="n"><Termino k="mediana" /></th><th className="n">Por m²</th></tr></thead>
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
          <h2>¿Dónde está?</h2>
          <MiniMapa feature={feature} conBase={conBase} />
          <p className="nota">Contorno de la zona{conBase ? '' : ' (de demostración: no es el límite real)'}.</p>
        </aside>
      </div>

      <h2>Anuncios recientes en la zona</h2>
      {(r.anomalias.inflados + r.anomalias.subprecio + r.anomalias.justos) > 0 && (
        <p className="nota"><Termino k="anomalia" /> de los {num(r.anomalias.inflados + r.anomalias.subprecio + r.anomalias.justos)} anuncios comparables: {num(r.anomalias.justos)} justos, {num(r.anomalias.inflados)} inflados y {num(r.anomalias.subprecio)} de subprecio.</p>
      )}
      {f.listados_recientes.length === 0 ? <p className="nota">Esta zona aún no tiene anuncios.</p> : (
        <ul className="inmuebles">
          {f.listados_recientes.map((l) => (
            <li key={l.id}>
              <span className="inm-tipo">{TIPOS[l.tipo_inmueble]?.replace(/s$/, '') ?? l.tipo_inmueble}</span>
              <b>{mxnC(l.precio_mxn)}</b><small>/mes</small>
              <span>{l.superficie_m2 !== null ? `${entero(l.superficie_m2)} m²` : 'superficie n/d'} · {l.recamaras === null ? 'rec. n/d' : l.recamaras === 0 ? 'estudio' : `${l.recamaras} rec.`}</span>
              <small>{l.publicado_en ?? 'sin fecha'}</small>
              <Etiqueta valor={l.anomalia} />
            </li>
          ))}
        </ul>
      )}
      <p className="nota">Cada tarjeta es un inmueble. Por privacidad no se muestra el enlace al anuncio ni los datos de quien lo publica.</p>

      <details className="tecnico">
        <summary>Detalles técnicos: de dónde salen los datos</summary>
        <dl className="ficha">
          <dt><Termino k="claveGeo" /></dt><dd><code>{f.clave_geo ?? 's/clave'}</code> · {f.tipo_unidad}</dd>
          <dt><Termino k="municipio" /></dt><dd>{f.ciudad} (clave {f.cve_ent}{f.cve_mun}){f.localidad ? ` · localidad: ${f.localidad}` : ''}</dd>
          <dt>Contorno de la zona</dt><dd>{t.fuente_geom ?? '—'} · {t.modo_datos === 'fixture' ? 'de demostración' : t.modo_datos ?? '—'} · cargado el {fechaMX(t.fecha_carga)}</dd>
          <dt>Precios actualizados</dt><dd>{fechaMX(t.precios_actualizados_en)}</dd>
          <dt>Última recaptura</dt><dd>{t.ultima_recaptura_en ? fechaMX(t.ultima_recaptura_en) : 'ninguna registrada todavía'}</dd>
        </dl>
      </details>
      <p className="nota"><Link href="/colonias">← Volver a explorar zonas</Link> · <Link href="/rentas">Ver todos los precios de renta</Link></p>
    </div>
  );
}


