#!/usr/bin/env node
// Genera data/fixtures/renta_fixture.csv: listados de renta SINTÉTICOS (no son de ningún portal) para probar MVP-3.
// Determinista (semilla fija): volver a correrlo produce el mismo archivo.   Uso:  node scripts/generar-fixture-renta.mjs
//
// Las coordenadas se toman del DENUE sintético (data/fixtures/denue_fixture.csv), acercando cada punto al centro de su
// AGEB sintética: así caen dentro de las zonas de MVP-2 sin depender de la geometría exacta. El archivo incluye a propósito:
//   · 360 listados válidos con zona (≥300 exigidos) con formatos de precio/m²/recámaras variados (para ejercitar la normalización)
//   · 8 sin superficie y 5 sin recámaras (campos clave nulos que NO descartan el listado)
//   · 12 válidos fuera de toda zona (se cargan sin zona)
//   · 19 filas defectuosas que deben descartarse, cada una por un motivo distinto (ver DEFECTUOSAS)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DENUE = path.join(RAIZ, 'data', 'fixtures', 'denue_fixture.csv');
const SALIDA = path.join(RAIZ, 'data', 'fixtures', 'renta_fixture.csv');

const N_VALIDOS = 360, N_SIN_SUP = 8, N_SIN_REC = 5, N_FUERA = 12;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(20261017);
const entre = (a, b) => a + rnd() * (b - a);
const entero = (a, b) => Math.floor(entre(a, b + 1));
const elegir = (xs) => xs[Math.floor(rnd() * xs.length)];
const ponderado = (pares) => { let r = rnd() * pares.reduce((s, p) => s + p[1], 0); for (const [v, w] of pares) { if ((r -= w) < 0) return v; } return pares.at(-1)[0]; };

// ── puntos del DENUE sintético por AGEB (se excluyen FX00/FX01: son las filas defectuosas del fixture de MVP-2) ──
function filasCsv(texto) {
  const filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) { if (ch === '"' && texto[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
    else if (ch === '\n') { f.push(c.replace(/\r$/, '')); filas.push(f); f = []; c = ''; } else c += ch;
  }
  if (c || f.length) { f.push(c); filas.push(f); }
  return filas;
}
const [cab, ...datos] = filasCsv(readFileSync(DENUE, 'utf8'));
const ix = Object.fromEntries(cab.map((h, i) => [h.trim(), i]));
const porAgeb = new Map();
for (const r of datos) {
  const ageb = r[ix.ageb];
  if (r[ix.cve_mun] !== '114' || !/^FX\d\d$/.test(ageb) || ageb === 'FX00' || ageb === 'FX01') continue;
  const lat = Number(r[ix.latitud]), lon = Number(r[ix.longitud]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (!porAgeb.has(ageb)) porAgeb.set(ageb, []);
  porAgeb.get(ageb).push([lat, lon]);
}
const zonas = [...porAgeb.entries()].filter(([, p]) => p.length >= 20).sort().map(([ageb, pts]) => ({
  ageb, pts, cy: pts.reduce((s, p) => s + p[0], 0) / pts.length, cx: pts.reduce((s, p) => s + p[1], 0) / pts.length,
}));
const [minX, maxX] = [Math.min(...zonas.map((z) => z.cx)), Math.max(...zonas.map((z) => z.cx))];
const [minY, maxY] = [Math.min(...zonas.map((z) => z.cy)), Math.max(...zonas.map((z) => z.cy))];
for (const z of zonas) z.factor = (0.85 + 0.55 * (0.6 * ((z.cx - minX) / (maxX - minX)) + 0.4 * ((z.cy - minY) / (maxY - minY)))) * entre(0.95, 1.05);

// ── un listado válido (valores numéricos "limpios") ──
const redondea = (n, m) => Math.round(n / m) * m;
function listadoValido() {
  const z = zonas[Math.floor(rnd() * zonas.length)];
  const [py, px] = elegir(z.pts), t = entre(0.25, 0.7);                   // punto entre un negocio y el centro de la zona
  const lat = py + t * (z.cy - py), lon = px + t * (z.cx - px);
  const tipo = ponderado([['departamento', 58], ['casa', 27], ['cuarto', 15]]);
  let sup, rec, precio;
  if (tipo === 'departamento') {
    sup = redondea(entre(34, 112), 1); rec = sup < 44 ? ponderado([[0, 1], [1, 4]]) : sup < 70 ? ponderado([[1, 1], [2, 4]]) : sup < 95 ? ponderado([[2, 3], [3, 2]]) : 3;
    precio = redondea(sup * 150 * z.factor * entre(0.9, 1.15), 50);
  } else if (tipo === 'casa') {
    sup = redondea(entre(70, 220), 1); rec = sup < 110 ? 2 : sup < 160 ? 3 : 4;
    precio = redondea(sup * 105 * z.factor * entre(0.9, 1.15), 50);
  } else {
    sup = redondea(entre(9, 22), 1); rec = 1;
    precio = redondea((entre(2200, 3600) + sup * 20) * z.factor, 50);
  }
  const dia = String(entero(1, 16)).padStart(2, '0');
  return { tipo, precio, sup, rec, lat: lat.toFixed(6), lon: lon.toFixed(6), fecha: `2026-10-${dia}`, zona: z.ageb };
}

// ── formato "sucio" realista, para ejercitar la normalización ──
const miles = (n) => n.toLocaleString('en-US');
function textoPrecio(n) {
  return ponderado([[() => String(n), 50], [() => miles(n), 30], [() => `$${miles(n)}`, 12], [() => `$ ${miles(n)}.00 MXN`, 6], [() => `${n} mensuales`, 2]])();
}
const textoSup = (n) => ponderado([[() => String(n), 55], [() => `${n} m2`, 20], [() => `${n}m²`, 15], [() => `${n}.0`, 10]])();
const textoRec = (n) => (n === 0 ? 'estudio' : ponderado([[() => String(n), 70], [() => `${n} rec`, 20], [() => `${n} recámaras`, 10]])());

let seq = 100000;
const nuevoId = () => `SX-${++seq}`;
const urlDe = (id) => `https://ejemplo.invalid/anuncios/${id}`;
const COLS = ['id_anuncio', 'url', 'tipo', 'precio', 'moneda', 'superficie_m2', 'recamaras', 'latitud', 'longitud', 'fecha_publicacion'];
function aFila(l, o = {}) {
  const id = o.id ?? nuevoId();
  return {
    id_anuncio: id, url: urlDe(id), tipo: l.tipo, precio: o.precio ?? textoPrecio(l.precio), moneda: o.moneda ?? (rnd() < 0.5 ? 'MXN' : ''),
    superficie_m2: o.sup ?? textoSup(l.sup), recamaras: o.rec ?? textoRec(l.rec), latitud: o.lat ?? l.lat, longitud: o.lon ?? l.lon, fecha_publicacion: l.fecha,
  };
}

// 1) válidos con zona, sin dos con la misma huella (tipo|precio|m²|rec|lat4|lon4) por casualidad
const llave = (l) => [l.tipo, l.precio.toFixed(2), l.sup.toFixed(2), l.rec, Number(l.lat).toFixed(4), Number(l.lon).toFixed(4)].join('|');
const base = [], vistas = new Set();
while (base.length < N_VALIDOS) { const l = listadoValido(); if (!vistas.has(llave(l))) { vistas.add(llave(l)); base.push(l); } }
const idx = [...base.keys()];
const sacar = (n) => idx.splice(0, n);
for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
const sinSup = new Set(sacar(N_SIN_SUP)), sinRec = new Set(sacar(N_SIN_REC));
const filas = base.map((l, i) => aFila(l, { sup: sinSup.has(i) ? '' : undefined, rec: sinRec.has(i) ? '' : undefined }));
for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
const conHuella = base.map((l, i) => i).filter((i) => !sinSup.has(i));      // candidatos a ser republicados

// 2) válidos fuera de toda zona (norte, sur y oriente de la cuadrícula; se cargan sin zona)
const zonaFuera = [[19.075, 19.14, -98.30, -98.24], [19.0, 19.015, -98.215, -98.19], [19.03, 19.05, -98.165, -98.15]];
const fuera = Array.from({ length: N_FUERA }, () => {
  const [a, b, c, d] = elegir(zonaFuera), l = listadoValido();
  return aFila(l, { lat: entre(a, b).toFixed(6), lon: entre(c, d).toFixed(6) });
});

// 3) defectuosas: exactamente 19, cada una con el motivo de descarte que se espera
const ejemplo = () => listadoValido();
const DEFECTUOSAS = [
  ...[1, 2, 3].map(() => ({ motivo: 'precio faltante', f: aFila(ejemplo(), { precio: '' }) })),
  { motivo: 'precio no numérico', f: aFila(ejemplo(), { precio: 'consultar' }) },
  { motivo: 'precio no numérico', f: aFila(ejemplo(), { precio: 'a tratar' }) },
  { motivo: 'moneda no soportada', f: aFila(ejemplo(), { precio: '1,200 USD' }) },
  { motivo: 'moneda no soportada', f: aFila(ejemplo(), { precio: '900', moneda: 'USD' }) },
  { motivo: 'precio fuera de rango', f: aFila(ejemplo(), { precio: '120' }) },
  { motivo: 'precio fuera de rango', f: aFila(ejemplo(), { precio: '9999999' }) },
  { motivo: 'sin coordenadas', f: aFila(ejemplo(), { lat: '', lon: '' }) },
  { motivo: 'sin coordenadas', f: aFila(ejemplo(), { lat: '', lon: '' }) },
  { motivo: 'coordenadas no numéricas', f: aFila(ejemplo(), { lat: 'abc' }) },
  { motivo: 'coordenadas fuera de México', f: aFila(ejemplo(), { lat: '0', lon: '0' }) },
  { motivo: 'sin id de anuncio', f: { ...aFila(ejemplo()), id_anuncio: '', url: '' } },
];
const aleatorios = [];
const salida = [...filas, ...fuera];
for (let i = salida.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [salida[i], salida[j]] = [salida[j], salida[i]]; }
for (const d of DEFECTUOSAS) salida.splice(Math.floor(rnd() * (salida.length + 1)), 0, d.f);
// id repetido y republicaciones: SIEMPRE después de la fila original
function despuesDe(original, copia) {
  const i = salida.findIndex((f) => f.id_anuncio === original.id_anuncio);
  salida.splice(i + 1 + Math.floor(rnd() * (salida.length - i)), 0, copia);
}
const origenes = idx.slice(0, 5).map((k) => filas[conHuella[k % conHuella.length]]);
for (const o of origenes.slice(0, 2)) despuesDe(o, { ...aFila(ejemplo(), { id: o.id_anuncio }), tipo: 'casa' }); // 2 · id duplicado en el archivo
for (const o of origenes.slice(2, 5)) despuesDe(o, { ...o, id_anuncio: nuevoId(), url: urlDe(`SX-R${seq}`) });   // 3 · misma oferta, otro id

const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
writeFileSync(SALIDA, [COLS.join(','), ...salida.map((f) => COLS.map((c) => esc(f[c] ?? '')).join(','))].join('\n') + '\n', 'utf8');
void aleatorios;
console.log(`${SALIDA}\n  filas: ${salida.length} · válidas con zona: ${N_VALIDOS} (sin m²: ${N_SIN_SUP}, sin recámaras: ${N_SIN_REC}) · fuera de zonas: ${N_FUERA} · defectuosas: ${DEFECTUOSAS.length + 5}`);
