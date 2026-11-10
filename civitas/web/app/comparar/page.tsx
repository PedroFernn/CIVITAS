import { Fragment } from 'react';
import Link from 'next/link';
import MiniMapa from '@/components/MiniMapa';
import AvisoDatos from '@/components/AvisoDatos';
import { api, num } from '@/lib/api';
import { modosDatos, type ModosDatos } from '@/lib/modo';
import { entero, idsDeComparacion, MAX_COMPARAR, mxn2, mxnC, type Comparacion, type FeatureCatalogo, type ItemComparacion, type ListaCatalogo } from '@/lib/zonas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comparar zonas · CIVITAS' };

type SP = Record<string, string | string[] | undefined>;
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const SIN = 'Pocos datos';
const dif = (d: number | null) => (d === null ? '—' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`);
const precio = (z: ItemComparacion, v: string) => (z.estadistica_suprimida ? SIN : v);

interface Fila { grupo: string; etiqueta: string; texto: (z: ItemComparacion) => string }
const FILAS: Fila[] = [
  { grupo: 'Precio', etiqueta: 'Renta típica al mes', texto: (z) => precio(z, mxnC(z.renta_mediana)) },
  { grupo: 'Precio', etiqueta: 'Rango normal de rentas', texto: (z) => precio(z, z.renta_p25 === null ? '—' : `${mxnC(z.renta_p25)} – ${mxnC(z.renta_p75)}`) },
  { grupo: 'Precio', etiqueta: 'Renta por m²', texto: (z) => precio(z, z.precio_m2_mediano === null ? '—' : mxn2(z.precio_m2_mediano)) },
  { grupo: 'Precio', etiqueta: 'Frente al promedio de la ciudad', texto: (z) => precio(z, dif(z.renta_vs_ciudad_pct)) },
  { grupo: 'Precio', etiqueta: 'Lugar por precio (1 = más cara)', texto: (z) => precio(z, z.posicion_precio_m2 ? `${z.posicion_precio_m2.lugar} de ${z.posicion_precio_m2.de}` : '—') },
  { grupo: 'Precio', etiqueta: 'Anuncios de renta', texto: (z) => entero(z.n_listados) },
  { grupo: 'Comercio', etiqueta: 'Comercios', texto: (z) => entero(z.num_comercios) },
  { grupo: 'Comercio', etiqueta: 'Comercios de mayoreo', texto: (z) => entero(z.num_comercios_mayoreo) },
  { grupo: 'Comercio', etiqueta: 'Comercios de menudeo', texto: (z) => entero(z.num_comercios_menudeo) },
  { grupo: 'Comercio', etiqueta: 'Comercios por km²', texto: (z) => (z.densidad_comercios_km2 === null ? '—' : num(z.densidad_comercios_km2, 0)) },
  { grupo: 'Transporte', etiqueta: 'Paradas de transporte', texto: (z) => entero(z.num_paradas) },
  { grupo: 'Transporte', etiqueta: 'Paradas por km²', texto: (z) => (z.paradas_por_km2 === null ? '—' : num(z.paradas_por_km2, 1)) },
  { grupo: 'Zona', etiqueta: 'Área (km²)', texto: (z) => (z.area_km2 === null ? '—' : num(z.area_km2, 2)) },
];

/** P-07 · Comparador de hasta 3 zonas lado a lado. Todo viaja en la URL (`?items=a,b,c`): se puede compartir y funciona sin JavaScript. */
export default async function Comparar({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const solo = uno(sp.solo) === 'diferencias';
  let ids = idsDeComparacion(uno(sp.items));
  const nueva = idsDeComparacion(uno(sp.agregar))[0];
  let aviso: string | null = null;
  if (nueva && !ids.includes(nueva)) {
    if (ids.length >= MAX_COMPARAR) aviso = `Solo se pueden comparar ${MAX_COMPARAR} zonas a la vez: quita una para añadir otra.`;
    else ids = [...ids, nueva];
  }
  const url = (xs: string[], s = solo) => `/comparar${xs.length || s ? '?' : ''}${[xs.length ? `items=${xs.join(',')}` : '', s ? 'solo=diferencias' : ''].filter(Boolean).join('&')}`;

  let cmp: Comparacion | null = null, catalogo: ListaCatalogo, modos: ModosDatos;
  try {
    [catalogo, modos] = await Promise.all([
      api<ListaCatalogo>('/zonas?limit=600&orden=nombre&piloto=false'),
      modosDatos(),
    ]);
    if (ids.length) cmp = await api<Comparacion>(`/zonas/comparar?items=${ids.join(',')}`);
  } catch (e) {
    const msg = (e as Error).message;
    return (
      <div>
        <h1>Comparar zonas</h1>
        {msg.includes('HTTP 404') || msg.includes('HTTP 400')
          ? <p className="aviso-borrador">Alguna de las zonas del enlace no existe. <Link href="/comparar">Empezar de nuevo</Link></p>
          : <p className="aviso-borrador">No se pudo cargar la comparación en este momento. Inténtalo de nuevo en unos minutos.</p>}
      </div>
    );
  }

  const zonas = cmp?.items ?? [];
  const disponibles = catalogo.items.filter((z) => !ids.includes(z.id));
  const filas = FILAS.map((f) => ({ f, textos: zonas.map(f.texto) }));
  const visibles = solo && zonas.length > 1 ? filas.filter(({ textos }) => new Set(textos).size > 1) : filas;
  const lleno = ids.length >= MAX_COMPARAR;

  return (
    <div className="ancho">
      <h1>Comparar zonas</h1>
      <p className="lead">¿Dudas entre dos o tres zonas? Ponlas lado a lado (hasta {MAX_COMPARAR}) y compara precio, comercios y transporte. Elígelas desde <Link href="/colonias">Explorar zonas</Link> o añádelas aquí abajo. «Mostrar solo diferencias» esconde lo que es igual en todas.</p>
      <AvisoDatos modos={modos} />
      {aviso && <p className="aviso-borrador" role="alert">{aviso}</p>}

      <form className="filtros filtros-comparar" method="get" action="/comparar">
        {ids.length > 0 && <input type="hidden" name="items" value={ids.join(',')} />}
        {solo && <input type="hidden" name="solo" value="diferencias" />}
        <label>Añadir una zona
          <select name="agregar" defaultValue="" disabled={lleno} required>
            <option value="" disabled>{lleno ? `Ya hay ${MAX_COMPARAR} zonas` : 'Elige una zona…'}</option>
            {disponibles.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select></label>
        <div className="filtros-acciones">
          <button type="submit" disabled={lleno}>Añadir</button>
          {ids.length > 0 && <Link href={url([], false)} className="enlace-sec">Vaciar</Link>}
        </div>
      </form>

      {zonas.length === 0 ? (
        <p className="vacio">Todavía no hay zonas para comparar. Añade una arriba o márcalas con «Comparar» en el <Link href="/colonias">catálogo</Link>.</p>
      ) : (
        <>
          <p className="resumen-resultados" role="status">
            Comparando <strong>{zonas.length}</strong> de {MAX_COMPARAR} como máximo
            {zonas.length > 1 && <> · <Link href={url(ids, !solo)}>{solo ? 'Mostrar todos los indicadores' : 'Mostrar solo diferencias'}</Link></>}
          </p>
          {zonas.length === 1 && <p className="nota">Añade otra zona para ver las diferencias.</p>}

          <div className="tabla-scroll tabla-datos">
            <table className="tabla-comparar">
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  {zonas.map((z) => (
                    <th scope="col" key={z.id} className="col-zona">
                      <Link href={`/colonias/${z.id}`}>{z.nombre}</Link>
                      <small><Link href={url(ids.filter((x) => x !== z.id))} aria-label={`Quitar ${z.nombre} de la comparación`}>Quitar</Link></small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ f, textos }, i) => (
                  <Fragment key={f.etiqueta}>
                    {(i === 0 || visibles[i - 1].f.grupo !== f.grupo) && <tr key={`g-${f.grupo}`} className="grupo-fila"><th colSpan={zonas.length + 1} scope="colgroup">{f.grupo}</th></tr>}
                    <tr>
                      <th scope="row">{f.etiqueta}</th>
                      {textos.map((t, k) => <td key={zonas[k].id} className={t === SIN ? 'suprimida' : undefined}>{t}</td>)}
                    </tr>
                  </Fragment>
                ))}
                {visibles.length === 0 && <tr><td colSpan={zonas.length + 1}>Estas zonas coinciden en todos los indicadores.</td></tr>}
              </tbody>
            </table>
          </div>
          {zonas.some((z) => z.estadistica_suprimida) && (
            <p className="nota">«{SIN}»: la zona tiene menos de {cmp!.min_listados_estadistica} anuncios de renta; con tan pocos, la cifra no sería confiable.</p>
          )}

          <div className="minimapas">
            {zonas.map((z) => {
              const f: FeatureCatalogo = { type: 'Feature', id: z.id, properties: z, geometry: z.geometry };
              return <figure key={z.id}><MiniMapa feature={f} conBase={modos.zonas === 'real'} /><figcaption>{z.nombre}</figcaption></figure>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
