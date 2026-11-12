import Link from 'next/link';
import AvisoDatos from '@/components/AvisoDatos';
import Explorador from '@/components/Explorador';
import Termino from '@/components/Termino';
import { api, num, type Municipio } from '@/lib/api';
import { modosDatos, type ModosDatos } from '@/lib/modo';
import { API_PUBLICA, OPCIONES_PARADAS, type ListaCatalogo, type Metrica } from '@/lib/zonas';

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
  const municipio = uno(sp.municipio);
  const minParadas = OPCIONES_PARADAS.some(([k]) => k && k === uno(sp.min_paradas)) ? uno(sp.min_paradas) : undefined;
  const pagina = Math.max(1, Number(uno(sp.pagina)) || 1);
  const orden = uno(sp.orden) && ORDENES.some(([k]) => k === uno(sp.orden)) && !(uno(sp.orden) === 'relevancia' && !q) ? uno(sp.orden)! : q ? 'relevancia' : 'nombre';

  const filtros = new URLSearchParams();
  if (q) filtros.set('q', q);
  if (municipio) filtros.set('ciudad', municipio); // en el API el «municipio» es la ciudad de la zona (nombre oficial de INEGI)
  if (minRenta) filtros.set('min_renta', minRenta);
  if (maxRenta) filtros.set('max_renta', maxRenta);
  if (minParadas) filtros.set('min_paradas', minParadas);
  if (conPrecio) filtros.set('con_precio', 'true');
  filtros.set('orden', orden);
  filtros.set('piloto', 'false'); // el catálogo muestra todas las zonas del estado, no solo las 30 piloto

  let lista: ListaCatalogo, municipios: Municipio[], modos: ModosDatos;
  try {
    [lista, municipios, modos] = await Promise.all([
      api<ListaCatalogo>(`/zonas?${filtros}&limit=${POR_PAGINA}&offset=${(pagina - 1) * POR_PAGINA}`),
      api<Municipio[]>('/municipios').catch(() => []),
      modosDatos(),
    ]);
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
  const enlace = (p: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) { const x = uno(v); if (x && k !== 'pagina') u.set(k, x); } u.set('pagina', String(p)); return `/colonias?${u}`; };
  const metrica: Metrica = orden === 'renta' ? 'renta' : orden === 'comercios' ? 'comercios' : orden === 'paradas' ? 'paradas' : 'precio_m2';
  const hayFiltros = !!(q || municipio || minRenta || maxRenta || minParadas || conPrecio);

  // Chips de los filtros activos: cada uno quita solo su filtro y deja los demás.
  const sinParam = (...ks: string[]) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) { const x = uno(v); if (x && !ks.includes(k) && k !== 'pagina') u.set(k, x); } const t = u.toString(); return t ? `/colonias?${t}` : '/colonias'; };
  const chips: { texto: string; quitar: string }[] = [
    ...(q ? [{ texto: `«${q}»`, quitar: sinParam('q', 'orden') }] : []),
    ...(municipio ? [{ texto: `Municipio: ${municipio}`, quitar: sinParam('municipio') }] : []),
    ...(minRenta ? [{ texto: `Renta desde ${minRenta} $`, quitar: sinParam('min_renta') }] : []),
    ...(maxRenta ? [{ texto: `Renta hasta ${maxRenta} $`, quitar: sinParam('max_renta') }] : []),
    ...(minParadas ? [{ texto: OPCIONES_PARADAS.find(([k]) => k === minParadas)![1], quitar: sinParam('min_paradas') }] : []),
    ...(conPrecio ? [{ texto: 'Solo con precio de renta', quitar: sinParam('con_precio') }] : []),
  ];
  const geoUrl = `${API_PUBLICA}/zonas/geojson?${filtros}&limit=3000`;

  return (
    <div className="ancho">
      <h1>{q ? <>Resultados para «{q}»</> : municipio ? <>Zonas de {municipio}</> : 'Catálogo de zonas'}</h1>
      {!q && !municipio && (
        <p className="lead">Cada zona es un área urbana de un municipio de Puebla (una AGEB del INEGI). Elige un criterio arriba del mapa para colorearlo (por ejemplo, dónde la renta
          es más cara), filtra por municipio, haz clic en una zona para ver su ficha, o marca «Comparar» en hasta 3 tarjetas para ponerlas lado a lado.</p>
      )}
      <AvisoDatos modos={modos} />

      <form className="filtros" method="get" action="/colonias">
        <label>Buscar una zona<input name="q" defaultValue={q ?? ''} placeholder="colonia, localidad o municipio" maxLength={60} /></label>
        <label><Termino k="municipio" />
          <select name="municipio" defaultValue={municipio ?? ''}>
            <option value="">Todos ({num(municipios.length)})</option>
            {municipios.map((m) => <option key={m.cve_mun} value={m.nombre}>{m.nombre} ({num(m.n_zonas)})</option>)}
          </select></label>
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

      {chips.length > 0 && (
        <ul className="chips" aria-label="Filtros activos">
          {chips.map((c) => <li key={c.texto}><Link href={c.quitar} aria-label={`Quitar el filtro ${c.texto}`}>{c.texto}<i aria-hidden="true">×</i></Link></li>)}
        </ul>
      )}

      <p className="resumen-resultados" role="status">
        <strong>{num(lista.total)}</strong> {lista.total === 1 ? 'zona encontrada' : 'zonas encontradas'}
        {lista.total > 0 && <> · mostrando {num((pagina - 1) * POR_PAGINA + 1)}–{num(Math.min(pagina * POR_PAGINA, lista.total))}</>}
      </p>

      <Explorador conBase={modos.zonas === 'real'} items={lista.items} geoUrl={geoUrl} municipiosUrl={modos.zonas === 'real' ? `${API_PUBLICA}/municipios/geojson?simplificar=0.003` : undefined}
        minListados={lista.min_listados_estadistica} metricaInicial={metrica}>
        {paginas > 1 && (
          <nav className="paginacion" aria-label="Páginas de resultados">
            {pagina > 1 ? <Link href={enlace(pagina - 1)} rel="prev">← Anterior</Link> : <span aria-disabled="true">← Anterior</span>}
            <span>Página {num(pagina)} de {num(paginas)}</span>
            {pagina < paginas ? <Link href={enlace(pagina + 1)} rel="next">Siguiente →</Link> : <span aria-disabled="true">Siguiente →</span>}
          </nav>
        )}
      </Explorador>
    </div>
  );
}
