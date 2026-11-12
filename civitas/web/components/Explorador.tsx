'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MapaLeaflet from './MapaLeaflet';
import Termino from './Termino';
import { MAX_COMPARAR, METRICAS, mxnC, plural, type FeatureCatalogo, type Metrica, type ZonaCatalogo } from '@/lib/zonas';

const CLAVE_COMPARAR = 'civitas_comparar';
type Elegida = { id: string; nombre: string };
type Municipios = { type: 'FeatureCollection'; features: unknown[] };

/**
 * Lista + mapa del catálogo (P-02): son la misma consulta con dos representaciones; el cursor y el clic los mantienen sincronizados.
 * Con todo el estado (miles de zonas) el contorno NO viaja dentro de la página: el navegador lo descarga aparte (`geoUrl`) y lo reutiliza
 * entre páginas de la lista, porque la dirección no cambia mientras no cambien los filtros.
 */
export default function Explorador({ items, geoUrl, municipiosUrl, minListados, metricaInicial, conBase = false, children }: {
  conBase?: boolean; items: ZonaCatalogo[]; geoUrl: string; municipiosUrl?: string; minListados: number; metricaInicial: Metrica; children?: React.ReactNode;
}) {
  const [features, setFeatures] = useState<FeatureCatalogo[] | null>(null);
  const [municipios, setMunicipios] = useState<Municipios | null>(null);
  const [falloMapa, setFalloMapa] = useState(false);
  const [intento, setIntento] = useState(0);
  const [metrica, setMetrica] = useState<Metrica>(metricaInicial);
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const lista = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setFeatures(null); setFalloMapa(false);
    fetch(geoUrl, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g) => setFeatures(g.features as FeatureCatalogo[]))
      .catch((e) => { if (e?.name !== 'AbortError') setFalloMapa(true); });
    return () => ctl.abort();
  }, [geoUrl, intento]);
  useEffect(() => {
    if (!municipiosUrl) return;
    const ctl = new AbortController();
    fetch(municipiosUrl, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : null)).then((g) => g && setMunicipios(g)).catch(() => undefined);
    return () => ctl.abort();
  }, [municipiosUrl]);

  // Zonas elegidas para comparar (hasta 3). Viven en sessionStorage para no perderse al paginar el catálogo.
  const [elegidas, setElegidas] = useState<Elegida[]>([]);
  useEffect(() => {
    try { setElegidas(JSON.parse(sessionStorage.getItem(CLAVE_COMPARAR) ?? '[]').slice(0, MAX_COMPARAR)); } catch { /* sin almacenamiento: la selección dura lo que la página */ }
  }, []);
  const guardar = (e: Elegida[]) => {
    setElegidas(e);
    try { sessionStorage.setItem(CLAVE_COMPARAR, JSON.stringify(e)); } catch { /* idem */ }
  };
  const alternar = (z: ZonaCatalogo) => guardar(elegidas.some((e) => e.id === z.id) ? elegidas.filter((e) => e.id !== z.id) : elegidas.length < MAX_COMPARAR ? [...elegidas, { id: z.id, nombre: z.nombre }] : elegidas);

  useEffect(() => {
    if (!sel) return;
    lista.current?.querySelector<HTMLElement>(`[data-id="${sel}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sel]);

  return (
    <div className="explorador">
      <div className="explorador-mapa">
        <div className="metricas" role="group" aria-label="Colorear el mapa por">
          {METRICAS.map((m) => (
            <button key={m.clave} type="button" aria-pressed={metrica === m.clave} className={metrica === m.clave ? 'activa' : ''} onClick={() => setMetrica(m.clave)}>{m.etiqueta}</button>
          ))}
        </div>
        {features ? (
          <MapaLeaflet conBase={conBase} features={features} municipios={municipios} metrica={metrica} resaltadaId={hover} seleccionadaId={sel} onHover={setHover} onSelect={setSel}
            altura={460} etiqueta="Mapa de zonas coloreado por la métrica elegida; la lista de al lado tiene los mismos datos" />
        ) : (
          <div className="mapa-espera" style={{ height: 460 }} role="status">
            {falloMapa ? <>No se pudo cargar el mapa. <button type="button" className="enlace" onClick={() => setIntento((n) => n + 1)}>Reintentar</button></> : 'Cargando el mapa de zonas…'}
          </div>
        )}
        {features && <p className="nota mapa-nota">{plural(features.length, 'zona', 'zonas')} en el mapa. Haz clic en una para ubicarla en la lista.</p>}
      </div>
      <div className="explorador-lista">
        {elegidas.length > 0 && (
          <div className="barra-comparar" role="status">
            <span><b>Comparar</b> {elegidas.length} de {MAX_COMPARAR}: {elegidas.map((e) => e.nombre).join(' · ')}</span>
            <span className="barra-comparar-acciones">
              <Link href={`/comparar?items=${elegidas.map((e) => e.id).join(',')}`}>{elegidas.length === 1 ? 'Elegir otra para comparar' : 'Ver comparación'}</Link>
              <button type="button" className="enlace" onClick={() => guardar([])}>Vaciar</button>
            </span>
          </div>
        )}
        {items.length === 0 ? (
          <p className="vacio">Ninguna zona coincide con estos filtros. <Link href="/colonias">Quitar filtros</Link></p>
        ) : (
          <ol ref={lista} className="tarjetas">
            {items.map((z) => (
              <li key={z.id} data-id={z.id} className={`tarjeta ${hover === z.id ? 'resaltada' : ''} ${sel === z.id ? 'seleccionada' : ''}`}
                onMouseEnter={() => setHover(z.id)} onMouseLeave={() => setHover(null)}>
                <div className="tarjeta-cab">
                  <h3><Link href={`/colonias/${z.id}`}>{z.nombre}</Link></h3>
                  <span className="tarjeta-lugar">{z.ciudad}{z.localidad && z.localidad !== z.ciudad ? ` · ${z.localidad}` : ''}</span>
                </div>
                {z.estadistica_suprimida ? (
                  <p className="suprimida">Pocos anuncios para dar una cifra confiable: {z.n_listados} (se publica con {minListados} o más).</p>
                ) : (
                  <p className="tarjeta-precio"><b>{mxnC(z.renta_mediana)}</b> <small>al mes · <Termino k="mediana" etiqueta="renta típica" /></small>
                    {z.precio_m2_mediano !== null && <> · <b>{mxnC(z.precio_m2_mediano)}</b> <small>por m²</small></>}</p>
                )}
                <p className="tarjeta-datos">
                  {z.poblacion !== null && <>{plural(z.poblacion, 'habitante', 'habitantes')} · </>}
                  {plural(z.num_comercios, 'comercio', 'comercios')} · {plural(z.num_paradas, 'parada', 'paradas')} · {plural(z.n_listados, 'anuncio', 'anuncios')}
                </p>
                <div className="tarjeta-pie">
                  <Link className="ver-ficha" href={`/colonias/${z.id}`} aria-label={`Ver ficha de ${z.nombre}`}>Ver detalle</Link>
                  <label className="comparar-check">
                    <input type="checkbox" checked={elegidas.some((e) => e.id === z.id)} disabled={!elegidas.some((e) => e.id === z.id) && elegidas.length >= MAX_COMPARAR}
                      onChange={() => alternar(z)} /> Comparar
                  </label>
                </div>
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </div>
  );
}
