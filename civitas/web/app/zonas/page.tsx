import Link from 'next/link';
import MapaZonas from '@/components/MapaZonas';
import TablaDatos, { type Columna, type Fila, type OpcionOrden } from '@/components/TablaDatos';
import Termino from '@/components/Termino';
import { GLOSARIO } from '@/lib/glosario';
import AvisoDatos from '@/components/AvisoDatos';
import { api, num, type FeatureZona, type ListaZonas } from '@/lib/api';
import { modosDatos } from '@/lib/modo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zonas piloto · CIVITAS' };

const COLUMNAS: Columna[] = [
  { clave: 'nombre', etiqueta: 'Zona', tipo: 'enlace', href: 'href' },
  { clave: 'num_comercios', etiqueta: 'Comercios', tipo: 'entero', ayuda: GLOSARIO.comercios.texto },
  { clave: 'num_comercios_mayoreo', etiqueta: 'Mayoreo', tipo: 'entero', ayuda: GLOSARIO.mayoreo.texto },
  { clave: 'num_comercios_menudeo', etiqueta: 'Menudeo', tipo: 'entero', ayuda: GLOSARIO.menudeo.texto },
  { clave: 'num_paradas', etiqueta: 'Paradas de transporte', tipo: 'entero', ayuda: GLOSARIO.paradas.texto },
  { clave: 'area_km2', etiqueta: 'Tamaño (km²)', tipo: 'decimal', decimales: 2, ayuda: GLOSARIO.area.texto },
  { clave: 'densidad_comercios_km2', etiqueta: 'Comercios por km²', tipo: 'decimal', decimales: 0, ayuda: GLOSARIO.densidad.texto },
  { clave: 'clave_geo', etiqueta: 'Clave INEGI', tipo: 'codigo', ayuda: GLOSARIO.claveGeo.texto },
];

const OPCIONES: OpcionOrden[] = [
  { clave: 'comercios', etiqueta: 'Más comercios', columna: 'num_comercios', dir: 'desc' },
  { clave: 'paradas', etiqueta: 'Más paradas', columna: 'num_paradas', dir: 'desc' },
  { clave: 'mayoreo', etiqueta: 'Más comercios de mayoreo', columna: 'num_comercios_mayoreo', dir: 'desc' },
  { clave: 'menudeo', etiqueta: 'Más comercios de menudeo', columna: 'num_comercios_menudeo', dir: 'desc' },
  { clave: 'densidad', etiqueta: 'Más comercios por km²', columna: 'densidad_comercios_km2', dir: 'desc' },
  { clave: 'area', etiqueta: 'Más grandes', columna: 'area_km2', dir: 'desc' },
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
  const modos = await modosDatos();
  const totComercios = zonas.reduce((s, z) => s + z.num_comercios, 0);
  const totParadas = zonas.reduce((s, z) => s + z.num_paradas, 0);

  const filas: Fila[] = zonas.map((z) => ({
    id: z.id, href: `/colonias/${z.id}`, nombre: z.nombre, clave_geo: z.clave_geo,
    num_comercios: z.num_comercios, num_comercios_mayoreo: z.num_comercios_mayoreo, num_comercios_menudeo: z.num_comercios_menudeo,
    num_paradas: z.num_paradas, area_km2: z.area_km2, densidad_comercios_km2: z.densidad_comercios_km2,
  }));

  return (
    <div className="ancho">
      <h1>Datos de apoyo: zonas piloto</h1>
      <p className="lead">Además de los precios, CIVITAS mide qué hay alrededor: cuántos comercios y paradas de transporte tiene cada zona. Son datos abiertos
        (INEGI y transporte público) que ayudan a entender <em>por qué</em> una zona es más cara o más barata. Para ver precios de renta, entra a <Link href="/colonias">Explorar zonas</Link>.</p>
      <AvisoDatos modos={modos} capas={['zonas']} />

      <section className="kpis">
        <div><b>{num(lista.total)}</b><span>zonas piloto</span></div>
        <div><b>{num(totComercios)}</b><span><Termino k="comercios" /> en total</span></div>
        <div><b>{num(totParadas)}</b><span><Termino k="paradas" /> en total</span></div>
      </section>

      <h2>Mapa de comercios</h2>
      <p className="nota">Cuanto más oscura la zona, más comercios tiene. Pasa el cursor sobre una zona para ver sus números.</p>
      <MapaZonas zonas={geo.features} />

      <h2>Todas las zonas</h2>
      <p className="nota">Busca por nombre y elige cómo ordenar; los encabezados con «?» tienen una explicación al pasar el cursor. Cada zona abre su ficha.</p>
      <TablaDatos columnas={COLUMNAS} filas={filas} idFila="id" buscar={['nombre', 'clave_geo']} opciones={OPCIONES} ordenInicial="comercios"
        unidad={['zona', 'zonas']} placeholder="nombre o número de zona" />
    </div>
  );
}
