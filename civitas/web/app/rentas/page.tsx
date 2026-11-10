import Link from 'next/link';
import TablaDatos, { type Columna, type Fila, type OpcionOrden } from '@/components/TablaDatos';
import Termino from '@/components/Termino';
import { GLOSARIO } from '@/lib/glosario';
import AvisoDatos from '@/components/AvisoDatos';
import { modosDatos } from '@/lib/modo';
import { api, mxn, num, type ListaListados, type ReporteCalidad, type ResumenZonasRenta } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Precios de renta · CIVITAS' };

const POR_PAGINA = 15;
const ORDENES: [string, string][] = [
  ['reciente', 'Más recientes'], ['antiguo', 'Más antiguos'], ['precio', 'Renta más alta'], ['barato', 'Renta más baja'],
  ['precio_m2', 'Mayor renta por m²'], ['superficie', 'Más metros cuadrados'], ['recamaras', 'Más recámaras'],
];
const TIPOS: [string, string][] = [['departamento', 'Departamento'], ['casa', 'Casa'], ['cuarto', 'Cuarto'], ['otro', 'Otro']];
const RECAMARAS: [string, string][] = [['0', 'Estudio'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']];
const NOMBRE_TIPO = Object.fromEntries(TIPOS);

const COLUMNAS_ZONAS: Columna[] = [
  { clave: 'nombre', etiqueta: 'Zona', tipo: 'enlace', href: 'href' },
  { clave: 'n_listados', etiqueta: 'Anuncios', tipo: 'entero', ayuda: GLOSARIO.listados.texto },
  { clave: 'renta_mediana', etiqueta: 'Renta típica', tipo: 'mxn', vacio: 'Pocos datos', ayuda: GLOSARIO.mediana.texto },
  { clave: 'renta_p25', etiqueta: 'Renta baja', tipo: 'mxn', ayuda: GLOSARIO.p25.texto },
  { clave: 'renta_p75', etiqueta: 'Renta alta', tipo: 'mxn', ayuda: GLOSARIO.p75.texto },
  { clave: 'precio_m2_mediano', etiqueta: 'Renta por m²', tipo: 'mxn', ayuda: GLOSARIO.m2.texto },
];
const OPCIONES_ZONAS: OpcionOrden[] = [
  { clave: 'listados', etiqueta: 'Más anuncios', columna: 'n_listados', dir: 'desc' },
  { clave: 'renta', etiqueta: 'Renta típica más alta', columna: 'renta_mediana', dir: 'desc' },
  { clave: 'renta_baja', etiqueta: 'Renta típica más baja', columna: 'renta_mediana', dir: 'asc' },
  { clave: 'precio_m2', etiqueta: 'Más cara por m²', columna: 'precio_m2_mediano', dir: 'desc' },
  { clave: 'precio_m2_bajo', etiqueta: 'Más barata por m²', columna: 'precio_m2_mediano', dir: 'asc' },
  { clave: 'nombre', etiqueta: 'Nombre (A–Z)', columna: 'nombre', dir: 'asc' },
];

type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const fechaCorta = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('es-MX', { timeZone: 'UTC', dateStyle: 'medium' }) : '—');

export default async function Rentas({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = uno(sp.q), minPrecio = uno(sp.min_precio), maxPrecio = uno(sp.max_precio);
  const tipo = TIPOS.some(([k]) => k === uno(sp.tipo)) ? uno(sp.tipo) : undefined;
  const recamaras = RECAMARAS.some(([k]) => k === uno(sp.recamaras)) ? uno(sp.recamaras) : undefined;
  const orden = ORDENES.some(([k]) => k === uno(sp.orden)) ? uno(sp.orden)! : 'reciente';
  const pagina = Math.min(10_000, Math.max(1, Math.floor(Number(uno(sp.pagina))) || 1));

  // Los filtros del servidor solo afectan a «Listados de renta»; las tablas por zona se filtran en el navegador.
  const filtros = new URLSearchParams();
  if (q) filtros.set('q', q);
  if (tipo) filtros.set('tipo', tipo);
  if (recamaras) filtros.set('recamaras', recamaras);
  if (minPrecio) filtros.set('min_precio', minPrecio);
  if (maxPrecio) filtros.set('max_precio', maxPrecio);
  filtros.set('orden', orden);
  const hayFiltros = !!(q || tipo || recamaras || minPrecio || maxPrecio);

  let zonas: ResumenZonasRenta, lista: ListaListados, rep: ReporteCalidad | null;
  try {
    [zonas, lista] = await Promise.all([
      api<ResumenZonasRenta>('/listados-renta/resumen-zonas?limit=500'),
      api<ListaListados>(`/listados-renta?${filtros}&limit=${POR_PAGINA}&offset=${(pagina - 1) * POR_PAGINA}`),
    ]);
    rep = await api<ReporteCalidad>('/listados-renta/calidad').catch(() => null);
  } catch (e) {
    const msg = (e as Error).message;
    return (
      <div>
        <h1>Precios de renta</h1>
        {msg.includes('HTTP 400')
          ? <p className="aviso-borrador">Alguno de los filtros no es válido. <Link href="/rentas#listados">Quitar filtros</Link></p>
          : <p className="aviso-borrador">No se pudo cargar la información de rentas en este momento. Inténtalo de nuevo en unos minutos.</p>}
      </div>
    );
  }

  const modos = await modosDatos();
  const conPrecio = zonas.items.filter((z) => !z.estadistica_suprimida && z.renta_mediana !== null);
  const medianas = conPrecio.map((z) => z.renta_mediana as number);
  const totalListados = rep?.totales.acumulado.listados ?? zonas.items.reduce((s, z) => s + z.n_listados, 0);

  const filasZonas: Fila[] = zonas.items.map((z) => ({
    zona_id: z.zona_id, href: `/colonias/${z.zona_id}`, nombre: z.nombre, clave_geo: z.clave_geo, n_listados: z.n_listados,
    renta_mediana: z.renta_mediana, renta_p25: z.renta_p25, renta_p75: z.renta_p75, precio_m2_mediano: z.precio_m2_mediano,
  }));

  const paginas = Math.max(1, Math.ceil(lista.total / POR_PAGINA));
  const enlace = (p: number) => { const u = new URLSearchParams(filtros); u.set('pagina', String(p)); return `/rentas?${u}#listados`; };

  return (
    <div className="ancho">
      <h1>Precios de renta</h1>
      <p className="lead">Cuánto se paga de renta al mes por departamentos, casas y cuartos en cada zona. Primero ves el resumen por zona y,
        más abajo, los anuncios individuales que respaldan esas cifras. Cada zona abre su <Link href="/colonias">ficha</Link>.</p>
      <AvisoDatos modos={modos} capas={['precios']} />

      <section className="kpis">
        <div><b>{num(totalListados)}</b><span>listados de renta analizados</span></div>
        <div><b>{num(conPrecio.length)}</b><span>zonas con precio confiable (de {num(zonas.items.length)} con anuncios)</span></div>
        {medianas.length > 0 && (
          <div><b>{mxn(Math.min(...medianas))} – {mxn(Math.max(...medianas))}</b><span><Termino k="mediana" /> al mes: de la zona más barata a la más cara</span></div>
        )}
      </section>

      <h2>Renta por zona</h2>
      <p className="nota">Busca una zona y elige cómo ordenar. Las zonas con menos de {zonas.min_listados_estadistica} anuncios se muestran sin cifras: con tan pocos, el promedio no sería confiable. Los encabezados con «?» explican cada término.</p>
      <TablaDatos columnas={COLUMNAS_ZONAS} filas={filasZonas} idFila="zona_id" buscar={['nombre', 'clave_geo']} opciones={OPCIONES_ZONAS} ordenInicial="listados"
        unidad={['zona', 'zonas']} placeholder="nombre o número de zona" />

      <h2 id="listados">Anuncios de renta, uno por uno</h2>
      <p className="nota">Cada fila es un inmueble. Por privacidad no hay teléfonos ni nombres de quien anuncia.</p>
      <form className="filtros filtros-listados" method="get" action="/rentas#listados">
        <label>Buscar<input name="q" defaultValue={q ?? ''} placeholder="zona o código de anuncio" maxLength={60} /></label>
        <label>Tipo
          <select name="tipo" defaultValue={tipo ?? ''}><option value="">Todos</option>{TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label>Recámaras
          <select name="recamaras" defaultValue={recamaras ?? ''}><option value="">Cualquiera</option>{RECAMARAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label>Renta mínima<input name="min_precio" type="number" min={0} step={500} inputMode="numeric" defaultValue={minPrecio ?? ''} placeholder="$" /></label>
        <label>Renta máxima<input name="max_precio" type="number" min={0} step={500} inputMode="numeric" defaultValue={maxPrecio ?? ''} placeholder="$" /></label>
        <label>Ordenar por
          <select name="orden" defaultValue={orden}>{ORDENES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <div className="filtros-acciones">
          <button type="submit">Aplicar filtros</button>
          {hayFiltros && <Link href="/rentas#listados" className="enlace-sec">Limpiar</Link>}
        </div>
      </form>

      <p className="resumen-resultados" role="status">
        <strong>{num(lista.total)}</strong> {lista.total === 1 ? 'anuncio' : 'anuncios'}
        {lista.total > 0 && <> · mostrando {num((pagina - 1) * POR_PAGINA + 1)}–{num(Math.min(pagina * POR_PAGINA, lista.total))}</>}
      </p>

      {lista.items.length === 0 ? (
        <p className="vacio">Ningún listado coincide con estos filtros. <Link href="/rentas#listados">Quitar filtros</Link></p>
      ) : (
        <div className="tabla-scroll tabla-datos">
          <table>
            <thead><tr><th>Código</th><th>Tipo</th><th className="n">Renta</th><th className="n">m²</th><th className="n">Recámaras</th><th className="n">Renta por m²</th><th>Zona</th><th>Publicado</th></tr></thead>
            <tbody>
              {lista.items.map((l) => (
                <tr key={l.id}><td><code>{l.id_fuente}</code></td><td>{NOMBRE_TIPO[l.tipo_inmueble] ?? l.tipo_inmueble}</td><td className="n">{mxn(l.precio_mxn)}</td>
                  <td className="n">{num(l.superficie_m2, 0)}</td><td className="n">{l.recamaras === 0 ? 'Estudio' : l.recamaras ?? '—'}</td><td className="n">{mxn(l.precio_m2)}</td>
                  <td>{l.zona_id ? <Link href={`/colonias/${l.zona_id}`}>{l.zona_nombre}</Link> : <span className="suprimida">sin zona</span>}</td><td>{fechaCorta(l.publicado_en)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav className="paginacion" aria-label="Páginas de listados">
          {pagina > 1 ? <Link href={enlace(pagina - 1)} rel="prev">← Anterior</Link> : <span aria-disabled="true">← Anterior</span>}
          <span>Página {pagina} de {paginas}</span>
          {pagina < paginas ? <Link href={enlace(pagina + 1)} rel="next">Siguiente →</Link> : <span aria-disabled="true">Siguiente →</span>}
        </nav>
      )}
    </div>
  );
}
