import type { FeatureZona } from '@/lib/api';
import { num } from '@/lib/api';

type Pos = [number, number];

function anillos(g: FeatureZona['geometry']): Pos[][] {
  if (g.type === 'Polygon') return g.coordinates as Pos[][];
  if (g.type === 'MultiPolygon') return (g.coordinates as Pos[][][]).flat();
  return [];
}

const ESCALA = ['#e8eef7', '#c5d5ec', '#9cb8de', '#6f95cb', '#3f6cae', '#1d4580', '#0f2a4a'];

/** Mapa coroplético en SVG puro (sin dependencias): color = número de comercios por zona. */
export default function MapaZonas({ zonas }: { zonas: FeatureZona[] }) {
  const pts = zonas.flatMap((z) => anillos(z.geometry).flat());
  if (!pts.length) return <p>Sin geometrías que mostrar.</p>;
  const [lons, lats] = [pts.map((p) => p[0]), pts.map((p) => p[1])];
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);       // corrige la deformación E-O a esta latitud
  const W = 640, H = Math.round((W * (y1 - y0)) / ((x1 - x0) * k));
  const px = ([lo, la]: Pos) => `${(((lo - x0) / (x1 - x0)) * W).toFixed(1)},${(((y1 - la) / (y1 - y0)) * H).toFixed(1)}`;
  const max = Math.max(1, ...zonas.map((z) => z.properties.num_comercios));
  const color = (n: number) => (n === 0 ? '#f1f3f6' : ESCALA[Math.min(ESCALA.length - 1, Math.floor((n / max) * (ESCALA.length - 1)))]);

  return (
    <figure className="mapa">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa de zonas piloto coloreado por número de comercios">
        {zonas.map((z) => (
          <path key={z.id} fill={color(z.properties.num_comercios)} stroke="#fff" strokeWidth="1"
            d={anillos(z.geometry).map((r) => 'M' + r.map(px).join('L') + 'Z').join('')}>
            <title>{`${z.properties.nombre} · ${num(z.properties.num_comercios)} comercios · ${num(z.properties.num_paradas)} paradas`}</title>
          </path>
        ))}
      </svg>
      <figcaption>
        <span>Comercios por zona</span>
        <span className="leyenda">{ESCALA.map((c) => <i key={c} style={{ background: c }} />)}</span>
        <span>0 → {num(max)}</span>
      </figcaption>
    </figure>
  );
}
