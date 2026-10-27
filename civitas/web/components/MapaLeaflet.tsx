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
  /** Mapa estático (minimapa de la ficha): sin zoom, arrastre ni popups. */
  interactivo?: boolean;
  altura?: number;
  etiqueta: string;
}

export function textoValor(f: FeatureCatalogo, m: Metrica): string {
  const v = valorMetrica(f.properties, m);
  if (v === null) return 'sin estadística';
  return m === 'precio_m2' ? `${mxnC(v)}/m²` : m === 'renta' ? `${mxnC(v)}/mes` : entero(v);
}

/**
 * Mapa Leaflet de zonas (capa GeoJSON coloreada por una métrica). Sin capa base a propósito: con datos sintéticos, dibujar las zonas
 * sobre el mapa real de Puebla daría a entender que son límites reales. Las zonas sin estadística publicable van en gris.
 */
export default function MapaLeaflet({ features, metrica, resaltadaId, seleccionadaId, onHover, onSelect, interactivo = true, altura = 420, etiqueta }: Props) {
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
      fillColor: colorEscala(v, min, max), fillOpacity: v === null ? 0.55 : 0.88,
      color: sel ? '#d48a00' : hover ? '#d48a00' : '#ffffff', weight: sel ? 3 : hover ? 2.5 : 1,
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
      });
      mapa.current = m;
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
      m.fitBounds(g.getBounds(), { padding: [16, 16], maxZoom: 15 });
      // La caja puede cambiar de tamaño después (CSS responsive): se recalcula una vez asentado el diseño.
      setTimeout(() => { if (!cancelado) { m.invalidateSize(); m.fitBounds(g.getBounds(), { padding: [16, 16], maxZoom: 15 }); } }, 120);
    })();
    return () => { cancelado = true; mapa.current?.remove(); mapa.current = null; capa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, interactivo]);

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
  const fmt = (v: number) => (metrica === 'precio_m2' || metrica === 'renta' ? mxnC(v) : entero(v));
  return (
    <figure className="mapa-leaflet">
      <div ref={el} className="mapa-lienzo" style={{ height: altura }} role="img" aria-label={etiqueta} />
      {interactivo && (
        <figcaption>
          <span className="leyenda" aria-hidden="true">{ESCALA.map((c) => <i key={c} style={{ background: c }} />)}</span>
          <span>{max > min ? `${fmt(min)} → ${fmt(max)} ${unidad}` : unidad}</span>
          {(metrica === 'precio_m2' || metrica === 'renta') && <span className="leyenda-sin"><i style={{ background: COLOR_SIN_DATO }} aria-hidden="true" /> sin estadística</span>}
        </figcaption>
      )}
    </figure>
  );
}
