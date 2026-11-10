'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { entero, mxnC, normalizar, terminos } from '@/lib/zonas';

/** Tabla con buscador, orden (lista y encabezados) y paginación en el navegador. Recibe solo datos serializables. */
export type TipoColumna = 'texto' | 'codigo' | 'entero' | 'decimal' | 'mxn' | 'fecha' | 'enlace';
export interface Columna {
  clave: string;          // campo de la fila
  etiqueta: string;
  ayuda?: string;         // explicación en lenguaje llano (se muestra al pasar el cursor)
  tipo: TipoColumna;
  decimales?: number;     // solo 'decimal'
  href?: string;          // solo 'enlace': campo de la fila con la URL
  vacio?: string;         // texto cuando no hay valor (por defecto «—»)
}
export interface OpcionOrden { clave: string; etiqueta: string; columna: string; dir: 'asc' | 'desc' }
export type Fila = Record<string, string | number | boolean | null>;

const numerica = (t: TipoColumna) => t === 'entero' || t === 'decimal' || t === 'mxn';
const decimal = (n: number, d: number) => n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
/** Fecha ISO → «4 nov 2026, 10:30» en hora de Ciudad de México (igual que fechaMX). Si no es una fecha válida, devuelve el texto tal cual. */
const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
};
/** Un número de 1–3 dígitos («4», «04») es un número de zona: se busca solo en el nombre (igual que la búsqueda del catálogo). */
const esNumeroCorto = (t: string) => /^\d{1,3}$/.test(t);

function Valor({ c, f }: { c: Columna; f: Fila }) {
  const v = f[c.clave];
  if (v === null || v === undefined || v === '') {
    return c.vacio ? <span className="suprimida">{c.vacio}</span> : <>—</>;
  }
  switch (c.tipo) {
    case 'codigo': return <code>{String(v)}</code>;
    case 'entero': return <>{entero(Number(v))}</>;
    case 'decimal': return <>{decimal(Number(v), c.decimales ?? 1)}</>;
    case 'mxn': return <>{mxnC(Number(v))}</>;
    case 'fecha': return <>{fecha(String(v))}</>;
    case 'enlace': {
      const href = c.href ? f[c.href] : null;
      return typeof href === 'string' ? <Link href={href}>{String(v)}</Link> : <>{String(v)}</>;
    }
    default: return <>{String(v)}</>;
  }
}

export default function TablaDatos({ columnas, filas, idFila, buscar, opciones, ordenInicial, unidad, porPagina = 15, placeholder }: {
  columnas: Columna[]; filas: Fila[]; idFila: string;
  buscar: string[];                  // campos donde busca el texto; el primero es el nombre
  opciones: OpcionOrden[]; ordenInicial: string;
  unidad: [string, string];          // [singular, plural] para el resumen: «zona», «zonas»
  porPagina?: number; placeholder?: string;
}) {
  const inicial = opciones.find((o) => o.clave === ordenInicial) ?? opciones[0];
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState({ col: inicial.columna, dir: inicial.dir });
  const [pagina, setPagina] = useState(1);

  const claveBuscar = buscar.join('|');
  const indice = useMemo(
    () => filas.map((f) => ({
      nombre: normalizar(String(f[buscar[0]] ?? '')),
      todo: normalizar(buscar.map((k) => f[k] ?? '').join(' ')),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, claveBuscar],
  );

  const ts = useMemo(() => terminos(q), [q]);
  const visibles = useMemo(() => {
    const col = columnas.find((c) => c.clave === orden.col) ?? columnas[0];
    const num = numerica(col.tipo);
    const sign = orden.dir === 'asc' ? 1 : -1;
    return filas
      .filter((_, i) => ts.every((t) => (esNumeroCorto(t) ? indice[i].nombre.includes(t) : indice[i].todo.includes(t))))
      .sort((a, b) => {
        const x = a[col.clave], y = b[col.clave];
        if ((x === null || x === undefined) && (y === null || y === undefined)) return 0;
        if (x === null || x === undefined) return 1;      // sin dato siempre al final, en cualquier dirección
        if (y === null || y === undefined) return -1;
        const r = num ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' });
        return r * sign;
      });
  }, [filas, indice, ts, orden, columnas]);

  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const actual = Math.min(pagina, paginas);
  const desde = (actual - 1) * porPagina;
  const pagFilas = visibles.slice(desde, desde + porPagina);

  const elegida = opciones.find((o) => o.columna === orden.col && o.dir === orden.dir)?.clave ?? '';
  const cambiarOpcion = (clave: string) => {
    const o = opciones.find((x) => x.clave === clave);
    if (o) { setOrden({ col: o.columna, dir: o.dir }); setPagina(1); }
  };
  const ordenarPor = (c: Columna) => {
    setOrden((o) => (o.col === c.clave ? { col: c.clave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col: c.clave, dir: numerica(c.tipo) ? 'desc' : 'asc' }));
    setPagina(1);
  };

  return (
    <div className="tabla-datos">
      <div className="filtros tabla-barra">
        <label>Buscar
          <input type="search" value={q} maxLength={60} placeholder={placeholder ?? 'Escribe para filtrar'}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
        </label>
        <label>Ordenar por
          <select value={elegida} onChange={(e) => cambiarOpcion(e.target.value)}>
            {elegida === '' && <option value="" disabled>Orden de la columna</option>}
            {opciones.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
          </select>
        </label>
        {q && <div className="filtros-acciones"><button type="button" className="secundario-fil" onClick={() => { setQ(''); setPagina(1); }}>Limpiar búsqueda</button></div>}
      </div>

      <p className="resumen-resultados" role="status">
        <strong>{entero(visibles.length)}</strong> {visibles.length === 1 ? unidad[0] : unidad[1]}
        {q && <> para «{q}»</>}
        {visibles.length > porPagina && <> · mostrando {entero(desde + 1)}–{entero(Math.min(desde + porPagina, visibles.length))}</>}
      </p>

      {visibles.length === 0 ? (
        <p className="vacio">Ninguna fila coincide con «{q}». Prueba con otra palabra o con menos términos.</p>
      ) : (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                {columnas.map((c) => {
                  const activa = orden.col === c.clave;
                  return (
                    <th key={c.clave} className={numerica(c.tipo) ? 'n' : undefined} aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="th-orden" title={c.ayuda} onClick={() => ordenarPor(c)}>
                        {c.etiqueta}{c.ayuda && <span className="th-ayuda" aria-hidden="true">?</span>}<span className="th-flecha" aria-hidden="true">{activa ? (orden.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pagFilas.map((f) => (
                <tr key={String(f[idFila])}>
                  {columnas.map((c) => <td key={c.clave} className={numerica(c.tipo) ? 'n' : undefined}><Valor c={c} f={f} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav className="paginacion" aria-label={`Páginas de ${unidad[1]}`}>
          <button type="button" disabled={actual <= 1} onClick={() => setPagina(actual - 1)}>← Anterior</button>
          <span>Página {actual} de {paginas}</span>
          <button type="button" disabled={actual >= paginas} onClick={() => setPagina(actual + 1)}>Siguiente →</button>
        </nav>
      )}
    </div>
  );
}
