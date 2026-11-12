import { num } from '@/lib/api';

type Pos = [number, number];
type Geom = { type: string; coordinates: any };

/** Lo mínimo que necesita el mosaico de cada zona (lo cumplen tanto el catálogo como las zonas piloto). */
export interface PiezaMosaico { id: string | number; geometry: Geom; properties: { nombre: string; num_comercios: number; num_paradas: number } }
/** Un municipio de INEGI: solo hace falta su contorno y su nombre. */
export interface PiezaMunicipio { id?: string | number; geometry: Geom; properties: { nombre: string; poblacion?: number | null } }

const anillos = (g: Geom): Pos[][] => (g.type === 'Polygon' ? (g.coordinates as Pos[][]) : g.type === 'MultiPolygon' ? (g.coordinates as Pos[][][]).flat() : []);

/** De cobalto profundo a amarillo talavera: el centro comercial «brilla». Pensada para fondo oscuro. */
const RAMPA = ['#1a2f6e', '#1f3f95', '#2a56c0', '#4f7fe0', '#8fb0f2', '#e6d06c', '#f3c316'];

/**
 * El mosaico de zonas en SVG puro (servidor). Con `municipios` dibuja primero la silueta del estado (los 217 municipios de INEGI)
 * y encima cada zona urbana (AGEB real), coloreada por su número de comercios. Sin `municipios`, solo las zonas.
 */
export default function Mosaico({ zonas, municipios = [], etiqueta }: { zonas: PiezaMosaico[]; municipios?: PiezaMunicipio[]; etiqueta?: string }) {
  const base = municipios.length ? municipios.map((m) => m.geometry) : zonas.map((z) => z.geometry);
  const pts = base.flatMap((g) => anillos(g).flat());
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const W = 640, H = Math.round((W * (y1 - y0)) / ((x1 - x0) * k));
  const X = (lo: number) => ((lo - x0) / (x1 - x0)) * W, Y = (la: number) => ((y1 - la) / (y1 - y0)) * H;
  // Escala por raíz y tope en el percentil 97: pocos comercios son casi todo el mapa; sin esto, casi todo quedaría del mismo azul.
  const valores = zonas.map((z) => Math.sqrt(z.properties.num_comercios)).sort((a, b) => a - b);
  const tope = valores[Math.floor(valores.length * 0.97)] || 1;
  const color = (n: number) => RAMPA[Math.min(RAMPA.length - 1, Math.floor((Math.sqrt(n) / tope) * (RAMPA.length - 1)))];
  const ruta = (g: Geom) =>
    anillos(g).map((r) => {
      let ult: [number, number] | null = null, d = '';
      for (const p of r) {
        const [a, b] = [X(p[0]), Y(p[1])];
        if (ult && Math.hypot(a - ult[0], b - ult[1]) < 0.9) continue; // descarta vértices a menos de ~1 px: mismo dibujo, mucho menos HTML
        d += `${d ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`;
        ult = [a, b];
      }
      return d + 'Z';
    }).join('');

  return (
    <figure className="mosaico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={etiqueta ?? `Mapa de ${municipios.length ? 'los municipios y ' : ''}las ${num(zonas.length)} zonas de Puebla coloreadas por cantidad de comercios; el centro de la capital es la zona más activa`}>
        {municipios.map((m, i) => (
          <path key={m.id ?? i} d={ruta(m.geometry)} fill="#15295f" stroke="#3b5aa8" strokeWidth=".7" strokeLinejoin="round">
            <title>{`${m.properties.nombre}${m.properties.poblacion ? ` · ${num(m.properties.poblacion)} habitantes` : ''}`}</title>
          </path>
        ))}
        {zonas.map((z) => (
          <path key={z.id} d={ruta(z.geometry)} fill={color(z.properties.num_comercios)} stroke="#0b1736" strokeWidth={municipios.length ? '.25' : '.6'} strokeLinejoin="round">
            <title>{`${z.properties.nombre}: ${num(z.properties.num_comercios)} comercios, ${num(z.properties.num_paradas)} paradas`}</title>
          </path>
        ))}
      </svg>
      <figcaption>
        <span>Menos comercios</span>
        <span className="mosaico-escala" aria-hidden="true">{RAMPA.map((c) => <i key={c} style={{ background: c }} />)}</span>
        <span>Más comercios</span>
      </figcaption>
    </figure>
  );
}
