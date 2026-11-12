'use client';
import 'leaflet/dist/leaflet.css';
import type { GeoJSON as CapaGeoJSON, Map as MapaL, PathOptions } from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { COLOR_SIN_DATO, ESCALA, colorEscala, entero, METRICAS, mxnC, valorMetrica, type FeatureCatalogo, type Metrica } from '@/lib/zonas';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Props {
  features: FeatureCatalogo[];
  metrica: Metrica;
  /** Zona resaltada desde fuera (p. ej. la tarjeta sobre la que está el cursor). */
  resaltadaId?: string | null;
  seleccionadaId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  /** Dibuja el mapa de calles debajo (solo con zonas reales: con zonas sintéticas daría a entender que son límites reales). */
  conBase?: boolean;
  /** Contorno de los municipios (INEGI) dibujado encima como líneas finas, sin interacción. */
  municipios?: { type: 'FeatureCollection'; features: unknown[] } | null;
  /** Mapa estático (minimapa de la ficha): sin zoom, arrastre ni popups. */
  interactivo?: boolean;
  altura?: number;
  etiqueta: string;
}

export function textoValor(f: FeatureCatalogo, m: Metrica): string {
  const v = valorMetrica(f.properties, m);
  if (v === null) return m === 'habitantes' || m === 'comercios_hab' ? 'sin dato del Censo' : 'sin estadística';
  return m === 'precio_m2' ? `${mxnC(v)}/m²` : m === 'renta' ? `${mxnC(v)}/mes` : m === 'habitantes' ? `${entero(v)} habitantes` : m === 'comercios_hab' ? `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} comercios por 1,000 hab.` : entero(v);
}

/**
 * Mapa Leaflet de zonas (capa GeoJSON coloreada por una métrica). Con zonas reales lleva mapa de calles debajo (OpenStreetMap);
 * con zonas sintéticas no, para no sugerir límites reales. Las zonas sin estadística publicable van en gris.
 */
export default function MapaLeaflet({ features, metrica, resaltadaId, seleccionadaId, onHover, onSelect, interactivo = true, altura = 420, etiqueta, conBase = false, municipios = null }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaL | null>(null);
  const capas = useRef(new Map<string, any>());
  const capa = useRef<CapaGeoJSON | null>(null);
  const cb = useRef({ onHover, onSelect });
  cb.current = { onHover, onSelect };
  const metricaRef = useRef(metrica);
  metricaRef.current = metrica;

  const [min, max] = useMemo(() => {
    const vs = features.map((f) => valorMetrica(f.properties, metrica)).filter((v): v is number => v !== null);
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 0];
  }, [features, metrica]);

  const estilo = (f: FeatureCatalogo, hover: boolean, sel: boolean): PathOptions => {
    const v = valorMetrica(f.properties, metrica);
    return {
      fillColor: colorEscala(v, min, max, metrica === 'precio_m2' || metrica === 'renta' ? 1 : 0.5), fillOpacity: v === null ? 0.35 : conBase ? 0.72 : 0.88,
      color: sel ? '#f3c316' : hover ? '#0b1736' : '#ffffff', weight: sel ? 3 : hover ? 2.5 : 0.8,
      dashArray: v === null ? '3 3' : undefined,
    };
  };

  // Crea el mapa y la capa cuando cambian las zonas.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelado || !el.current || !features.length) return;
      mapa.current?.remove();
      const m = L.map(el.current, {
        zoomControl: interactivo, dragging: interactivo, scrollWheelZoom: false, doubleClickZoom: interactivo, touchZoom: interactivo,
        boxZoom: false, keyboard: interactivo, attributionControl: false, zoomSnap: 0.25,
        preferCanvas: true, // con miles de zonas, canvas dibuja y responde mucho mejor que miles de elementos SVG
      });
      mapa.current = m;
      if (conBase) {
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'base-gris' }).addTo(m);
        L.control.attribution({ prefix: false }).addAttribution('© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>').addTo(m);
      }
      capas.current.clear();
      const g = L.geoJSON({ type: 'FeatureCollection', features } as any, {
        style: (f) => estilo(f as unknown as FeatureCatalogo, false, false),
        onEachFeature: (f, layer) => {
          const ft = f as unknown as FeatureCatalogo;
          capas.current.set(ft.id, layer);
          if (!interactivo) return;
          layer.bindTooltip(`<strong>${esc(ft.properties.nombre)}</strong><br>${esc(textoValor(ft, metricaRef.current))}`, { sticky: true });
          layer.on('mouseover', () => cb.current.onHover?.(ft.id));
          layer.on('mouseout', () => cb.current.onHover?.(null));
          layer.on('click', () => cb.current.onSelect?.(ft.id));
        },
      }).addTo(m);
      capa.current = g;
      if (municipios?.features.length) {
        L.geoJSON(municipios as any, { style: { fill: false, color: '#0b1736', weight: 1, opacity: 0.35 }, interactive: false }).addTo(m);
      }
      m.fitBounds(g.getBounds(), { padding: [16, 16], maxZoom: 15 });
      // La caja puede cambiar de tamaño después (CSS responsive): se recalcula una vez asentado el diseño.
      setTimeout(() => { if (!cancelado) { m.invalidateSize(); m.fitBounds(g.getBounds(), { padding: [16, 16], maxZoom: 15 }); } }, 120);
    })();
    return () => { cancelado = true; mapa.current?.remove(); mapa.current = null; capa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, interactivo, conBase, municipios]);

  // Recolorea y resalta sin recrear el mapa.
  useEffect(() => {
    for (const f of features) {
      const l = capas.current.get(f.id);
      if (!l) continue;
      l.setStyle(estilo(f, f.id === resaltadaId, f.id === seleccionadaId));
      if (f.id === resaltadaId || f.id === seleccionadaId) l.bringToFront?.();
      l.setTooltipContent?.(`<strong>${esc(f.properties.nombre)}</strong><br>${esc(textoValor(f, metrica))}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrica, resaltadaId, seleccionadaId, features, min, max]);

  const unidad = METRICAS.find((x) => x.clave === metrica)!.unidad;
  const fmt = (v: number) => (metrica === 'precio_m2' || metrica === 'renta' ? mxnC(v) : metrica === 'comercios_hab' ? v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : entero(v));
  return (
    <figure className="mapa-leaflet">
      <div ref={el} className="mapa-lienzo" style={{ height: altura }} role="img" aria-label={etiqueta} />
      {interactivo && (
        <figcaption>
          <span aria-hidden="true">Menos</span><span className="leyenda" aria-hidden="true">{ESCALA.map((c) => <i key={c} style={{ background: c }} />)}</span>
          <span>Más · {max > min ? `de ${fmt(min)} a ${fmt(max)} ${unidad}` : unidad}</span>
          {metrica !== 'comercios' && metrica !== 'paradas' && <span className="leyenda-sin"><i style={{ background: COLOR_SIN_DATO }} aria-hidden="true" /> {metrica === 'precio_m2' || metrica === 'renta' ? 'pocos datos' : 'sin dato'}</span>}
        </figcaption>
      )}
    </figure>
  );
}
