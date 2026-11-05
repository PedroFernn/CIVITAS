'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MapaLeaflet from './MapaLeaflet';
import { MAX_COMPARAR, METRICAS, mxnC, plural, type FeatureCatalogo, type Metrica, type ZonaCatalogo } from '@/lib/zonas';

const CLAVE_COMPARAR = 'civitas_comparar';
type Elegida = { id: string; nombre: string };

/** Lista + mapa del catálogo (P-02): son la misma consulta con dos representaciones; el cursor y el clic los mantienen sincronizados. */
export default function Explorador({ items, features, minListados, metricaInicial, children }: {
  items: ZonaCatalogo[]; features: FeatureCatalogo[]; minListados: number; metricaInicial: Metrica; children?: React.ReactNode;
}) {
  const [metrica, setMetrica] = useState<Metrica>(metricaInicial);
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const lista = useRef<HTMLOListElement>(null);
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
        <MapaLeaflet features={features} metrica={metrica} resaltadaId={hover} seleccionadaId={sel} onHover={setHover} onSelect={setSel}
          altura={460} etiqueta="Mapa de zonas coloreado por la métrica elegida; la lista de al lado tiene los mismos datos" />
      </div>
      <div className="explorador-lista">
        {elegidas.length > 0 && (
          <div className="barra-comparar" role="status">
            <span><b>Comparar</b> {elegidas.length} de {MAX_COMPARAR}: {elegidas.map((e) => e.nombre).join(' · ')}</span>
            <span className="barra-comparar-acciones">
              <Link href={`/comparar?items=${elegidas.map((e) => e.id).join(',')}`}>{elegidas.length === 1 ? 'Elegir otra en la comparación →' : 'Ver comparación →'}</Link>
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
                  <code>{z.clave_geo ?? 's/clave'}</code>
                </div>
                {z.estadistica_suprimida ? (
                  <p className="suprimida">Sin estadística de renta: {z.n_listados} {z.n_listados === 1 ? 'listado' : 'listados'} (se publica con {minListados} o más).</p>
                ) : (
                  <p className="tarjeta-precio"><b>{mxnC(z.renta_mediana)}</b> <small>renta mediana</small>
                    {z.precio_m2_mediano !== null && <> · <b>{mxnC(z.precio_m2_mediano)}</b> <small>por m²</small></>}</p>
                )}
                <p className="tarjeta-datos">{plural(z.n_listados, 'listado', 'listados')} · {plural(z.num_comercios, 'comercio', 'comercios')} · {plural(z.num_paradas, 'parada', 'paradas')}</p>
                <div className="tarjeta-pie">
                  <Link className="ver-ficha" href={`/colonias/${z.id}`} aria-label={`Ver ficha de ${z.nombre}`}>Ver ficha →</Link>
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


