import Link from 'next/link';
import Explorador from '@/components/Explorador';
import AvisoDatos from '@/components/AvisoDatos';
import { api, num } from '@/lib/api';
import { modosDatos, type ModosDatos } from '@/lib/modo';
import Termino from '@/components/Termino';
import { OPCIONES_PARADAS, type GeoCatalogo, type ListaCatalogo, type Metrica } from '@/lib/zonas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Catálogo de zonas · CIVITAS' };

const POR_PAGINA = 12;
const ORDENES: [string, string][] = [
  ['relevancia', 'Mejor coincidencia'], ['nombre', 'Nombre (A–Z)'], ['precio_m2', 'Más cara por m²'], ['renta', 'Renta típica más alta'],
  ['comercios', 'Más comercios'], ['paradas', 'Más paradas'], ['listados', 'Más anuncios'],
];
type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** P-02 · Explorador de zonas: búsqueda, filtros, lista y mapa (la misma consulta con dos representaciones). */
export default async function Catalogo({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = uno(sp.q), minRenta = uno(sp.min_renta), maxRenta = uno(sp.max_renta), conPrecio = uno(sp.con_precio) === 'true';
  const minParadas = OPCIONES_PARADAS.some(([k]) => k && k === uno(sp.min_paradas)) ? uno(sp.min_paradas) : undefined;
  const pagina = Math.max(1, Number(uno(sp.pagina)) || 1);
  const orden = uno(sp.orden) && ORDENES.some(([k]) => k === uno(sp.orden)) && !(uno(sp.orden) === 'relevancia' && !q) ? uno(sp.orden)! : q ? 'relevancia' : 'nombre';

  const filtros = new URLSearchParams();
  if (q) filtros.set('q', q);
  if (minRenta) filtros.set('min_renta', minRenta);
  if (maxRenta) filtros.set('max_renta', maxRenta);
  if (minParadas) filtros.set('min_paradas', minParadas);
  if (conPrecio) filtros.set('con_precio', 'true');
  filtros.set('orden', orden);

  let lista: ListaCatalogo, geo: GeoCatalogo, modos: ModosDatos;
  try {
    [lista, geo] = await Promise.all([
      api<ListaCatalogo>(`/zonas?${filtros}&piloto=false&limit=${POR_PAGINA}&offset=${(pagina - 1) * POR_PAGINA}`),
      api<GeoCatalogo>(`/zonas/geojson?${filtros}&piloto=false&limit=500`),
    ]);
    modos = await modosDatos();
  } catch (e) {
    const msg = (e as Error).message;
    return (
      <div>
        <h1>Catálogo de zonas</h1>
        {msg.includes('HTTP 400')
          ? <p className="aviso-borrador">Alguno de los filtros no es válido ({msg}). <Link href="/colonias">Quitar filtros</Link></p>
          : <p className="aviso-borrador">No se pudo contactar la API ({msg}). Levanta el stack (<code>docker compose up -d</code>) y carga los datos
            (<code>docker compose run --rm etl mvp2</code> y <code>etl mvp3</code>).</p>}
      </div>
    );
  }

  const paginas = Math.max(1, Math.ceil(lista.total / POR_PAGINA));
  const enlace = (p: number) => { const u = new URLSearchParams(filtros); u.set('pagina', String(p)); return `/colonias?${u}`; };
  const metrica: Metrica = orden === 'renta' ? 'renta' : orden === 'comercios' ? 'comercios' : orden === 'paradas' ? 'paradas' : 'precio_m2';
  const hayFiltros = !!(q || minRenta || maxRenta || minParadas || conPrecio);

  return (
    <div className="ancho">
      <h1>{q ? <>Resultados para «{q}»</> : 'Catálogo de zonas'}</h1>
      {!q && (
        <p className="lead">Cada zona es un área de la ciudad. Elige un criterio arriba del mapa para colorearlo (por ejemplo, dónde la renta es más cara),
          haz clic en una zona para ver su ficha, o marca «Comparar» en hasta 3 tarjetas para ponerlas lado a lado.</p>
      )}
      <AvisoDatos modos={modos} />

      <form className="filtros" method="get" action="/colonias">
        <label>Buscar una zona<input name="q" defaultValue={q ?? ''} placeholder="nombre o número de zona" maxLength={60} /></label>
        <label><Termino k="mediana" etiqueta="Renta típica desde" /><input name="min_renta" type="number" min={0} step={500} inputMode="numeric" defaultValue={minRenta ?? ''} placeholder="$ al mes" /></label>
        <label>Renta típica hasta<input name="max_renta" type="number" min={0} step={500} inputMode="numeric" defaultValue={maxRenta ?? ''} placeholder="$ al mes" /></label>
        <label>Transporte público
          <select name="min_paradas" defaultValue={minParadas ?? ''}>{OPCIONES_PARADAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label>Ordenar por
          <select name="orden" defaultValue={orden}>{ORDENES.filter(([k]) => k !== 'relevancia' || q).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="check"><input type="checkbox" name="con_precio" value="true" defaultChecked={conPrecio} /> Solo zonas con precio de renta</label>
        <div className="filtros-acciones">
          <button type="submit">Aplicar filtros</button>
          {hayFiltros && <Link href="/colonias" className="enlace-sec">Limpiar</Link>}
        </div>
      </form>

      <p className="resumen-resultados" role="status">
        <strong>{num(lista.total)}</strong> {lista.total === 1 ? 'zona encontrada' : 'zonas encontradas'}
        {lista.total > 0 && <> · mostrando {num((pagina - 1) * POR_PAGINA + 1)}–{num(Math.min(pagina * POR_PAGINA, lista.total))}</>}
      </p>

      <Explorador conBase={modos.zonas === 'real'} items={lista.items} features={geo.features} minListados={lista.min_listados_estadistica} metricaInicial={metrica}>
        {paginas > 1 && (
          <nav className="paginacion" aria-label="Páginas de resultados">
            {pagina > 1 ? <Link href={enlace(pagina - 1)} rel="prev">← Anterior</Link> : <span aria-disabled="true">← Anterior</span>}
            <span>Página {pagina} de {paginas}</span>
            {pagina < paginas ? <Link href={enlace(pagina + 1)} rel="next">Siguiente →</Link> : <span aria-disabled="true">Siguiente →</span>}
          </nav>
        )}
      </Explorador>
    </div>
  );
}


