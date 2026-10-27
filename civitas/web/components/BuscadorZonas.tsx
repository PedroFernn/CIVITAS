'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { API_PUBLICA, mxnC, resaltar, terminos, type RespuestaBusqueda, type ZonaCatalogo } from '@/lib/zonas';

const CLAVE_RECIENTES = 'civitas.busquedas';
const MAX_RECIENTES = 5;
const DEMORA_MS = 160;

const leerRecientes = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECIENTES) : []; }
  catch { return []; }
};
const guardarRecientes = (xs: string[]) => { try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(xs)); } catch { /* modo privado: se ignora */ } };

function Resaltado({ texto, ts }: { texto: string; ts: string[] }) {
  return <>{resaltar(texto, ts).map((p, i) => (p.m ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}</>;
}

/**
 * Buscador de zonas de la navbar: combobox accesible con autocompletado (nombre, CVEGEO o ciudad, sin acentos),
 * atajo «/» o Ctrl+K, flechas + Enter, recientes y sugeridas. Sin JavaScript sigue siendo un formulario GET a /colonias.
 */
export default function BuscadorZonas() {
  const router = useRouter();
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const cache = useRef(new Map<string, RespuestaBusqueda>());

  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [resp, setResp] = useState<RespuestaBusqueda | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  const [activo, setActivo] = useState(-1);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [intento, setIntento] = useState(0);

  const ts = useMemo(() => terminos(q), [q]);
  const items = resp?.items ?? [];
  const hayVerTodos = q.trim() !== '' && (resp?.total ?? 0) > 0;
  const opciones = items.length + (hayVerTodos ? 1 : 0);

  // ── atajos globales: «/» y Ctrl/Cmd+K enfocan la búsqueda ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const escribiendo = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.key === '/' && !escribiendo && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        campo.current?.focus();
        campo.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── cerrar al hacer clic fuera ──
  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, []);

  // ── consulta con espera corta; una respuesta vieja nunca pisa a una nueva (AbortController) ──
  useEffect(() => {
    if (!abierto) return;
    const clave = ts.join(' ');
    const guardada = cache.current.get(clave);
    if (guardada && intento === 0) { setResp(guardada); setEstado('idle'); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setEstado('cargando');
      try {
        const r = await fetch(`${API_PUBLICA}/zonas/buscar?q=${encodeURIComponent(q.trim())}&limit=8`, { signal: ctl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as RespuestaBusqueda;
        cache.current.set(clave, j);
        setResp(j); setEstado('idle'); setActivo(-1);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setEstado('error');
      }
    }, clave ? DEMORA_MS : 0);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, abierto, ts, intento]);

  const recordar = (texto: string) => {
    const t = texto.trim();
    if (!t) return;
    const nuevos = [t, ...recientes.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECIENTES);
    setRecientes(nuevos); guardarRecientes(nuevos);
  };
  const irAZona = (z: ZonaCatalogo) => { recordar(z.nombre); setAbierto(false); campo.current?.blur(); router.push(`/colonias/${z.id}`); };
  const irAResultados = (texto: string) => {
    recordar(texto); setAbierto(false); campo.current?.blur();
    router.push(texto.trim() ? `/colonias?q=${encodeURIComponent(texto.trim())}` : '/colonias');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (abierto && q) { setQ(''); setActivo(-1); } else { setAbierto(false); campo.current?.blur(); }
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) { setAbierto(true); return; }
      if (!opciones) return;
      setActivo((a) => (e.key === 'ArrowDown' ? (a + 1) % opciones : (a - 1 + opciones) % opciones));
    } else if (e.key === 'Enter') {
      if (activo >= 0 && activo < items.length) { e.preventDefault(); irAZona(items[activo]); }
      else if (activo === items.length && hayVerTodos) { e.preventDefault(); irAResultados(q); }
      else { e.preventDefault(); irAResultados(q); }
    } else if (e.key === 'Home' && abierto && opciones) { e.preventDefault(); setActivo(0); }
    else if (e.key === 'End' && abierto && opciones) { e.preventDefault(); setActivo(opciones - 1); }
  };

  const abrir = () => { setRecientes(leerRecientes()); setAbierto(true); };
  const idOpcion = (i: number) => `${id}-op-${i}`;
  const anuncio = estado === 'error' ? 'No se pudo buscar'
    : estado === 'cargando' ? 'Buscando…'
    : !abierto || !resp ? ''
    : resp.sugeridas ? `${items.length} zonas sugeridas`
    : resp.total === 0 ? 'Sin resultados' : `${resp.total} ${resp.total === 1 ? 'resultado' : 'resultados'}`;

  return (
    <div className="buscador" ref={caja}>
      <form role="search" action="/colonias" method="get" onSubmit={(e) => { e.preventDefault(); irAResultados(q); }}>
        <label htmlFor={`${id}-q`} className="solo-lectores">Buscar zona por nombre, clave INEGI o ciudad</label>
        <span className="buscador-icono" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>
        </span>
        <input
          ref={campo} id={`${id}-q`} name="q" type="search" value={q} autoComplete="off" spellCheck={false} maxLength={60}
          placeholder="Buscar zona, clave INEGI…" enterKeyHint="search"
          role="combobox" aria-expanded={abierto} aria-controls={`${id}-lista`} aria-autocomplete="list"
          aria-activedescendant={abierto && activo >= 0 ? idOpcion(activo) : undefined}
          onFocus={abrir} onChange={(e) => { setQ(e.target.value); setActivo(-1); if (!abierto) abrir(); }} onKeyDown={onKeyDown}
        />
        {q ? (
          <button type="button" className="buscador-borrar" aria-label="Borrar búsqueda" onClick={() => { setQ(''); setActivo(-1); campo.current?.focus(); }}>×</button>
        ) : (
          <kbd className="buscador-atajo" aria-hidden="true">/</kbd>
        )}
      </form>

      <p className="solo-lectores" role="status" aria-live="polite">{anuncio}</p>

      {abierto && (
        <div className="buscador-panel">
          {estado === 'error' ? (
            <div className="buscador-vacio">No se pudo buscar ahora.{' '}
              <button type="button" className="enlace" onClick={() => { cache.current.clear(); setIntento((n) => n + 1); }}>Reintentar</button></div>
          ) : (
            <>
              {!q.trim() && recientes.length > 0 && (
                <div className="buscador-recientes">
                  <div className="buscador-titulo">Búsquedas recientes
                    <button type="button" className="enlace" onClick={() => { setRecientes([]); guardarRecientes([]); }}>Borrar</button></div>
                  {recientes.map((r) => (
                    <button type="button" key={r} className="buscador-reciente" onClick={() => { setQ(r); campo.current?.focus(); }}>
                      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 5.5V10l3 2" /></svg>{r}</button>
                  ))}
                </div>
              )}
              <div className="buscador-titulo">{resp?.sugeridas || !q.trim() ? 'Zonas con más listados' : estado === 'cargando' ? 'Buscando…' : 'Zonas'}</div>
              <ul role="listbox" id={`${id}-lista`} aria-label="Zonas encontradas" onMouseDown={(e) => e.preventDefault()}>
                {items.map((z, i) => (
                  <li key={z.id} id={idOpcion(i)} role="option" aria-selected={i === activo} className={i === activo ? 'activo' : ''}
                    onMouseEnter={() => setActivo(i)} onClick={() => irAZona(z)}>
                    <span className="op-nombre"><Resaltado texto={z.nombre} ts={ts} /></span>
                    <span className="op-sub"><code><Resaltado texto={z.clave_geo ?? 's/clave'} ts={ts.filter((t) => !/^\d{1,3}$/.test(t))} /></code> · {z.ciudad}</span>
                    <span className="op-dato">
                      {z.estadistica_suprimida
                        ? <small>{z.n_listados} {z.n_listados === 1 ? 'listado' : 'listados'} · sin estadística</small>
                        : <><b>{mxnC(z.renta_mediana)}</b><small>renta mediana</small></>}
                    </span>
                  </li>
                ))}
                {hayVerTodos && (
                  <li id={idOpcion(items.length)} role="option" aria-selected={activo === items.length}
                    className={`op-todos ${activo === items.length ? 'activo' : ''}`} onMouseEnter={() => setActivo(items.length)} onClick={() => irAResultados(q)}>
                    Ver los {resp!.total} resultados para «{q.trim()}» →
                  </li>
                )}
              </ul>
              {estado !== 'cargando' && resp && items.length === 0 && (
                <div className="buscador-vacio">Sin resultados para «<strong>{q.trim()}</strong>». Prueba con parte del nombre, el número de la zona o la clave INEGI.</div>
              )}
            </>
          )}
          <div className="buscador-pie"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div>
        </div>
      )}
    </div>
  );
}
