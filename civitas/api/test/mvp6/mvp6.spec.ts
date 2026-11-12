import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leerEtiquetas } from '../../src/etl/mvp6/calcular';
import { evaluarPrecision, PRECISION_MIN } from '../../src/etl/mvp6/validacion';
import { armarComparacion, MIN_ZONAS_REFERENCIA } from '../../src/zonas/comparar';
import { parseFiltrosZonas } from '../../src/zonas/filtros-zonas';

describe('MVP-6 · etiquetas de la muestra', () => {
  const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'civitas-et-'));
  it('lee origen, ignora encabezado y filas inválidas', () => {
    const f = path.join(tmp(), 'et.csv');
    writeFileSync(f, '# origen=sembrado\nid_anuncio,etiqueta\na1,justo\na2,inflado\na3,rarísimo\n\na4,subprecio\n');
    const e = leerEtiquetas(f);
    expect(e.origen).toBe('sembrado');
    expect([...e.porIdFuente.entries()]).toEqual([['a1', 'justo'], ['a2', 'inflado'], ['a4', 'subprecio']]);
  });
  it('sin declarar origen es «desconocido» (nunca se asume humano)', () => {
    const f = path.join(tmp(), 'et.csv');
    writeFileSync(f, 'id_anuncio,etiqueta\na1,justo\n');
    expect(leerEtiquetas(f).origen).toBe('desconocido');
  });
});

describe('MVP-6 · evaluarPrecision', () => {
  it('falla por debajo de la meta, sin importar el origen', () => {
    expect(evaluarPrecision(PRECISION_MIN - 0.01, 100, [0.7, 0.9], 'humano').estado).toBe('fail');
  });
  it('con precisión suficiente: ok si la muestra es humana, warn si es sembrada', () => {
    expect(evaluarPrecision(0.95, 100, [0.9, 0.98], 'humano').estado).toBe('ok');
    const w = evaluarPrecision(0.95, 100, [0.9, 0.98], 'sembrado');
    expect(w.estado).toBe('warn');
    expect(w.detalle).toContain('SEMBRADAS');
  });
  it('sin anomalías detectadas no hay precisión que medir: falla', () => {
    expect(evaluarPrecision(0, 0, [0, 0], 'humano').estado).toBe('fail');
  });
});

describe('MVP-6 · referencia de precio por municipio con respaldo al estado', () => {
  const estado = { ciudad: 'todo el estado', n_listados: 1000, zonas: 100, renta_mediana: 10000, precio_m2_mediano: 100 };
  const zona = (ciudad: string) => ({ id: ciudad, ciudad, renta_mediana: 12000, area_km2: 1, num_paradas: 0, lugar: 3, de: 9, ambito_pos: 'municipio' });
  it('un municipio con suficientes zonas es la referencia', () => {
    const r = armarComparacion([zona('Puebla')], [{ ciudad: 'Puebla', n_listados: 500, zonas: MIN_ZONAS_REFERENCIA, renta_mediana: 15000, precio_m2_mediano: 120 }], estado, 5);
    expect(r.items[0]).toMatchObject({ referencia: 'Puebla', renta_vs_ciudad_pct: -20 });
    expect(r.items[0].posicion_precio_m2).toEqual({ lugar: 3, de: 9, ambito: 'municipio' });
  });
  it('un municipio chico se compara con todo el estado (no consigo mismo)', () => {
    const r = armarComparacion([zona('Tlacotepec')], [{ ciudad: 'Tlacotepec', n_listados: 8, zonas: MIN_ZONAS_REFERENCIA - 1, renta_mediana: 12000, precio_m2_mediano: 100 }], estado, 5);
    expect(r.items[0]).toMatchObject({ referencia: 'todo el estado', renta_vs_ciudad_pct: 20 });
  });
  it('sin ninguna referencia no inventa diferencia', () => {
    const r = armarComparacion([zona('X')], [], null, 5);
    expect(r.items[0]).toMatchObject({ referencia: null, renta_vs_ciudad_pct: null });
  });
});

describe('MVP-6 · simplificar del geojson', () => {
  it('acepta 0 a 0.01 y rechaza lo demás', () => {
    expect(parseFiltrosZonas({ simplificar: '0.0005' }).simplificar).toBe(0.0005);
    expect(parseFiltrosZonas({ simplificar: '0' }).simplificar).toBe(0);
    expect(parseFiltrosZonas({}).simplificar).toBeUndefined();
    for (const malo of ['-1', '0.5', 'abc', 'NaN', 'Infinity']) expect(() => parseFiltrosZonas({ simplificar: malo })).toThrow('simplificar');
  });
});
