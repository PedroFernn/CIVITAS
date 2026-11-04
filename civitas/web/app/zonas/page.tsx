import Link from 'next/link';
import MapaZonas from '@/components/MapaZonas';
import TablaDatos, { type Columna, type Fila, type OpcionOrden } from '@/components/TablaDatos';
import { api, num, type FeatureZona, type ListaZonas } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zonas piloto · CIVITAS' };

const COLUMNAS: Columna[] = [
  { clave: 'nombre', etiqueta: 'Zona', tipo: 'enlace', href: 'href' },
  { clave: 'clave_geo', etiqueta: 'Clave INEGI', tipo: 'codigo' },
  { clave: 'num_comercios', etiqueta: 'Comercios', tipo: 'entero' },
  { clave: 'num_comercios_mayoreo', etiqueta: 'Mayoreo', tipo: 'entero' },
  { clave: 'num_comercios_menudeo', etiqueta: 'Menudeo', tipo: 'entero' },
  { clave: 'num_paradas', etiqueta: 'Paradas', tipo: 'entero' },
  { clave: 'area_km2', etiqueta: 'Área km²', tipo: 'decimal', decimales: 2 },
  { clave: 'densidad_comercios_km2', etiqueta: 'Comercios/km²', tipo: 'decimal', decimales: 0 },
];

const OPCIONES: OpcionOrden[] = [
  { clave: 'comercios', etiqueta: 'Más comercios', columna: 'num_comercios', dir: 'desc' },
  { clave: 'paradas', etiqueta: 'Más paradas', columna: 'num_paradas', dir: 'desc' },
  { clave: 'mayoreo', etiqueta: 'Más comercios de mayoreo', columna: 'num_comercios_mayoreo', dir: 'desc' },
  { clave: 'menudeo', etiqueta: 'Más comercios de menudeo', columna: 'num_comercios_menudeo', dir: 'desc' },
  { clave: 'densidad', etiqueta: 'Mayor densidad de comercios', columna: 'densidad_comercios_km2', dir: 'desc' },
  { clave: 'area', etiqueta: 'Mayor área', columna: 'area_km2', dir: 'desc' },
  { clave: 'nombre', etiqueta: 'Nombre (A–Z)', columna: 'nombre', dir: 'asc' },
];

export default async function Zonas() {
  let lista: ListaZonas, geo: { features: FeatureZona[] };
  try {
    [lista, geo] = await Promise.all([
      api<ListaZonas>('/colonias?limit=200&orden=comercios'),
      api<{ features: FeatureZona[] }>('/colonias/geojson?limit=500'),
    ]);
  } catch {
    return (
      <div>
        <h1>Zonas piloto</h1>
        <p className="aviso-borrador">No se pudo cargar la información de las zonas en este momento. Inténtalo de nuevo en unos minutos.</p>
      </div>
    );
  }

  const zonas = lista.items;
  const sintetico = zonas.some((z) => z.modo_datos === 'fixture');
  const totComercios = zonas.reduce((s, z) => s + z.num_comercios, 0);
  const totParadas = zonas.reduce((s, z) => s + z.num_paradas, 0);

  const filas: Fila[] = zonas.map((z) => ({
    id: z.id, href: `/colonias/${z.id}`, nombre: z.nombre, clave_geo: z.clave_geo,
    num_comercios: z.num_comercios, num_comercios_mayoreo: z.num_comercios_mayoreo, num_comercios_menudeo: z.num_comercios_menudeo,
    num_paradas: z.num_paradas, area_km2: z.area_km2, densidad_comercios_km2: z.densidad_comercios_km2,
  }));

  return (
    <div className="ancho">
      <h1>Zonas piloto</h1>
      <p className="nota">Zonas de Puebla con su número de comercios y paradas de transporte. Para ver precios de renta, entra al <Link href="/colonias">catálogo</Link>.</p>
      {sintetico && (
        <p className="aviso-borrador"><strong>Datos sintéticos.</strong> Estas zonas, comercios y paradas son datos de prueba, no información real de INEGI.</p>
      )}

      <section className="kpis">
        <div><b>{num(lista.total)}</b><span>zonas piloto</span></div>
        <div><b>{num(totComercios)}</b><span>comercios</span></div>
        <div><b>{num(totParadas)}</b><span>paradas de transporte</span></div>
      </section>

      <h2>Mapa</h2>
      <MapaZonas zonas={geo.features} />

      <h2>Zonas</h2>
      <p className="nota">Busca por nombre o clave y elige cómo ordenar. Cada zona enlaza a su ficha en el <Link href="/colonias">catálogo</Link>.</p>
      <TablaDatos columnas={COLUMNAS} filas={filas} idFila="id" buscar={['nombre', 'clave_geo']} opciones={OPCIONES} ordenInicial="comercios"
        unidad={['zona', 'zonas']} placeholder="nombre, número o clave INEGI" />
    </div>
  );
}
