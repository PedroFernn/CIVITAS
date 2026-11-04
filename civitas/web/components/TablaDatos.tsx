'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type TipoColumna = 'texto' | 'codigo' | 'enlace' | 'entero' | 'decimal' | 'mxn' | 'fecha';
export interface Columna {
  clave: string;
  etiqueta: string;
  tipo: TipoColumna;
  /** Para tipo «enlace»: clave de la fila que trae la URL. */
  href?: string;
  /** Para tipo «decimal». */
  decimales?: number;
  /** Texto cuando el valor es nulo (por defecto «—»). */
  vacio?: string;
}
export type Fila = Record<string, string | number | boolean | null | undefined>;
export interface OpcionOrden { clave: string; etiqueta: string; columna: string; dir: 'asc' | 'desc' }

interface Props {
  columnas: Columna[];
  filas: Fila[];
  /** Clave de la fila que la identifica (key de React). */
  idFila: string;
  /** Claves de las columnas donde busca el cuadro de texto. */
  buscar: string[];
  opciones: OpcionOrden[];
  /** Clave de la opción de orden inicial. */
  ordenInicial: string;
  unidad: [singular: string, plural: string];
  placeholder?: string;
  porPagina?: number;
}

const NUMERICOS: TipoColumna[] = ['entero', 'decimal', 'mxn'];
const normalizar = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const nf = (n: number, d: number) => n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const fechaMX = (iso: string) => new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });

function celda(c: Columna, f: Fila) {
  const v = f[c.clave];
  if (v == null || v === '') return c.vacio ?? '—';
  switch (c.tipo) {
    case 'entero': return nf(Number(v), 0);
    case 'decimal': return nf(Number(v), c.decimales ?? 1);
    case 'mxn': return Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    case 'fecha': return fechaMX(String(v));
    case 'codigo': return <code>{String(v)}</code>;
    case 'enlace': return c.href && f[c.href] ? <Link href={String(f[c.href])}>{String(v)}</Link> : String(v);
    default: return String(v);
  }
}

/** Tabla con búsqueda, orden (por columna o desde el selector) y paginación, todo en el navegador. */
export default function TablaDatos({ columnas, filas, idFila, buscar, opciones, ordenInicial, unidad, placeholder, porPagina = 20 }: Props) {
  const inicial = opciones.find((o) => o.clave === ordenInicial) ?? opciones[0];
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState<{ columna: string; dir: 'asc' | 'desc' }>({ columna: inicial.columna, dir: inicial.dir });
  const [pagina, setPagina] = useState(1);

  const tipoDe = (col: string) => columnas.find((c) => c.clave === col)?.tipo ?? 'texto';

  const resultado = useMemo(() => {
    const q = normalizar(texto).trim();
    const base = q ? filas.filter((f) => buscar.some((k) => normalizar(f[k]).includes(q))) : filas;
    const num = NUMERICOS.includes(tipoDe(orden.columna));
    const signo = orden.dir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      const x = a[orden.columna], y = b[orden.columna];
      if (x == null || x === '') return y == null || y === '' ? 0 : 1; // los vacíos siempre al final
      if (y == null || y === '') return -1;
      const r = num ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' });
      return r * signo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, texto, orden, buscar]);

  const paginas = Math.max(1, Math.ceil(resultado.length / porPagina));
  const actual = Math.min(pagina, paginas);
  const visibles = resultado.slice((actual - 1) * porPagina, actual * porPagina);
  const opcionActiva = opciones.find((o) => o.columna === orden.columna && o.dir === orden.dir)?.clave ?? '';

  const ordenarPor = (col: string) => {
    setOrden((o) => (o.columna === col ? { columna: col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { columna: col, dir: NUMERICOS.includes(tipoDe(col)) || tipoDe(col) === 'fecha' ? 'desc' : 'asc' }));
    setPagina(1);
  };

  return (
    <div className="tabla-datos">
      <div className="filtros tabla-barra">
        <label>Buscar
          <input type="search" value={texto} placeholder={placeholder} maxLength={60}
            onChange={(e) => { setTexto(e.target.value); setPagina(1); }} /></label>
        <label>Ordenar por
          <select value={opcionActiva} onChange={(e) => {
            const o = opciones.find((x) => x.clave === e.target.value);
            if (o) { setOrden({ columna: o.columna, dir: o.dir }); setPagina(1); }
          }}>
            {!opcionActiva && <option value="">Orden de columna</option>}
            {opciones.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
          </select></label>
        <div className="filtros-acciones">
          <span className="resumen-resultados" role="status">
            <strong>{nf(resultado.length, 0)}</strong> {resultado.length === 1 ? unidad[0] : unidad[1]}
          </span>
          {texto && <button type="button" className="secundario-fil" onClick={() => { setTexto(''); setPagina(1); }}>Limpiar</button>}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="vacio">Ninguna fila coincide con la búsqueda.</p>
      ) : (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                {columnas.map((c) => {
                  const activa = orden.columna === c.clave;
                  const n = NUMERICOS.includes(c.tipo);
                  return (
                    <th key={c.clave} className={n ? 'n' : undefined} scope="col"
                      aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="th-orden" onClick={() => ordenarPor(c.clave)}>
                        {c.etiqueta}<span className="th-flecha" aria-hidden="true">{activa ? (orden.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={String(f[idFila])}>
                  {columnas.map((c) => <td key={c.clave} className={NUMERICOS.includes(c.tipo) ? 'n' : undefined}>{celda(c, f)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav className="paginacion" aria-label="Páginas de la tabla">
          <button type="button" disabled={actual <= 1} onClick={() => setPagina(actual - 1)}>← Anterior</button>
          <span>Página {actual} de {paginas}</span>
          <button type="button" disabled={actual >= paginas} onClick={() => setPagina(actual + 1)}>Siguiente →</button>
        </nav>
      )}
    </div>
  );
}
