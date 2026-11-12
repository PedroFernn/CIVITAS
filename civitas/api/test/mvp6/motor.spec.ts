import { calibrar, clasificar, evaluar, ListadoEntrada, mediana, MIN_GRUPO, sigmaRobusta, wilson, Etiqueta } from '../../src/anomalias/motor';

const L = (id: number, precioM2: number, o: Partial<ListadoEntrada> = {}): ListadoEntrada =>
  ({ id, zonaId: 'z1', cveMun: '114', tipo: 'departamento', recamaras: 2, precioM2, ...o });

/** 10 precios comparables alrededor de 100 $/m² con algo de dispersión real. */
const BASE = [96, 98, 99, 100, 100, 101, 102, 103, 97, 104];

describe('MVP-6 · motor de anomalías: estadística robusta', () => {
  it('mediana de pares y nones; vacía → NaN', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBeNaN();
  });
  it('σ robusta = 1.4826·MAD (en logaritmos) y nunca baja del piso de 0.08', () => {
    const xs = [90, 100, 110].map(Math.log);
    expect(sigmaRobusta(xs, Math.log(100))).toBeCloseTo(1.4826 * Math.abs(Math.log(110) - Math.log(100)), 6);
    expect(sigmaRobusta([0, 0, 0, 0], 0)).toBe(0.08); // MAD = 0 → piso
  });
  it('un valor extremo no mueve la mediana ni el MAD (por eso se usan)', () => {
    const lg = BASE.map(Math.log), sucio = [...BASE, 900].map(Math.log);
    expect(sigmaRobusta(sucio, mediana(sucio))).toBeLessThan(sigmaRobusta(lg, mediana(lg)) * 1.5);
    expect(mediana(sucio)).toBeCloseTo(mediana(lg), 1);
  });
  it('Wilson: contiene la proporción y se estrecha con más datos', () => {
    const [a, b] = wilson(8, 10), [c, d] = wilson(80, 100);
    expect(a).toBeLessThan(0.8); expect(b).toBeGreaterThan(0.8);
    expect(d - c).toBeLessThan(b - a);
    expect(wilson(0, 0)).toEqual([0, 0]);
  });
});

describe('MVP-6 · motor de anomalías: clasificar', () => {
  const ls = [...BASE.map((p, i) => L(i + 1, p)), L(11, 300), L(12, 30)];
  it('etiqueta inflado, subprecio y justo con el grupo de la zona', () => {
    const v = new Map(clasificar(ls, 2.5).map((x) => [x.id, x]));
    expect(v.get(11)).toMatchObject({ etiqueta: 'inflado', nivel: 'zona' });
    expect(v.get(12)).toMatchObject({ etiqueta: 'subprecio', nivel: 'zona' });
    expect(v.get(4)?.etiqueta).toBe('justo');
    expect(v.get(11)!.z).toBeGreaterThan(2.5);
    expect(v.get(12)!.z).toBeLessThan(-2.5);
  });
  it('un umbral más alto etiqueta menos anomalías', () => {
    const n = (u: number) => clasificar(ls, u).filter((v) => v.etiqueta !== 'justo').length;
    expect(n(1.5)).toBeGreaterThanOrEqual(n(2.5));
    expect(n(2.5)).toBeGreaterThanOrEqual(n(100));
    expect(n(100)).toBe(0);
  });
  it('con pocos datos en la zona amplía al municipio y luego al estado', () => {
    // 3 en la zona z9 (< mínimo) + muchos del mismo municipio y tipo en otras zonas
    const otros = Array.from({ length: MIN_GRUPO.municipio + 2 }, (_, i) => L(100 + i, 100 + (i % 3), { zonaId: `z${i}` }));
    const chico = [L(1, 100, { zonaId: 'z9' }), L(2, 101, { zonaId: 'z9' }), L(3, 400, { zonaId: 'z9' })];
    const v = new Map(clasificar([...chico, ...otros], 2.5).map((x) => [x.id, x]));
    expect(v.get(3)).toMatchObject({ nivel: 'municipio', etiqueta: 'inflado' });
    const solitos = clasificar([L(1, 100, { zonaId: 'a', cveMun: '001' }), L(2, 100, { zonaId: 'b', cveMun: '002' })], 2.5);
    expect(solitos).toEqual([]); // sin ningún grupo suficiente no se etiqueta: mejor callar que adivinar
  });
  it('no compara recámaras distintas ni tipos distintos', () => {
    const dos = BASE.map((p, i) => L(i + 1, p));
    const cuatro = BASE.map((p, i) => L(50 + i, p * 3, { recamaras: 4 })); // otro grupo con precios 3× mayores
    const v = new Map(clasificar([...dos, ...cuatro], 2.5).map((x) => [x.id, x]));
    expect([...v.values()].every((x) => x.etiqueta === 'justo')).toBe(true);
  });
});

describe('MVP-6 · motor de anomalías: ajuste por tipo y recámaras', () => {
  it('un cuarto caro por m² dentro de una zona de departamentos NO es una anomalía (el tipo ya cuesta más por m²)', () => {
    const deptos = Array.from({ length: 24 }, (_, i) => L(i + 1, 100 + (i % 4), { recamaras: 2 }));
    const cuartos = Array.from({ length: 10 }, (_, i) => L(100 + i, 135 + (i % 3), { tipo: 'cuarto', recamaras: 0 })); // ≈ 35 % más por m²
    const v = clasificar([...deptos, ...cuartos], 2.5);
    expect(v.filter((x) => x.id >= 100 && x.etiqueta !== 'justo')).toEqual([]);
  });
  it('sigue detectando un cuarto realmente inflado frente a los demás cuartos', () => {
    const deptos = Array.from({ length: 24 }, (_, i) => L(i + 1, 100 + (i % 4), { recamaras: 2 }));
    const cuartos = [...Array.from({ length: 9 }, (_, i) => L(100 + i, 135 + (i % 3), { tipo: 'cuarto', recamaras: 0 })), L(200, 300, { tipo: 'cuarto', recamaras: 0 })];
    expect(new Map(clasificar([...deptos, ...cuartos], 2.5).map((x) => [x.id, x.etiqueta])).get(200)).toBe('inflado');
  });
});

describe('MVP-6 · motor de anomalías: métricas y calibración', () => {
  const ls = [...BASE.map((p, i) => L(i + 1, p)), L(11, 300), L(12, 30)];
  const ref = new Map<number, Etiqueta>([...BASE.map((_, i) => [i + 1, 'justo'] as [number, Etiqueta]), [11, 'inflado'], [12, 'subprecio']]);
  it('precisión, recall y exactitud perfectas cuando el motor acierta todo', () => {
    const m = evaluar(clasificar(ls, 2.5), ref);
    expect(m).toMatchObject({ evaluados: 12, anomalosReales: 2, anomalosDetectados: 2, aciertos: 2, precision: 1, recall: 1, exactitud: 1 });
    expect(m.precisionIC[0]).toBeLessThan(1); // con n=2 el intervalo es amplio: no se cree un 100 %
  });
  it('acertar la anomalía pero con la etiqueta equivocada no cuenta como acierto', () => {
    const mala = new Map(ref); mala.set(11, 'subprecio');
    expect(evaluar(clasificar(ls, 2.5), mala).aciertos).toBe(1);
  });
  it('calibrar elige un umbral de la grilla con F1 máximo', () => {
    const c = calibrar(ls, ref, undefined, 2); // meta inalcanzable: cae al criterio de F1
    expect(c.criterio).toBe('f1');
    const mejor = Math.max(...c.tabla.map((t) => t.m.f1));
    expect(c.tabla.find((t) => t.umbral === c.umbral)!.m.f1).toBe(mejor);
  });
  it('calibrar prioriza la meta de precisión: el umbral más bajo que la cumple', () => {
    const c = calibrar(ls, ref, [1.5, 2.5, 4], 0.8);
    expect(c.criterio).toBe('precision');
    const cumplen = c.tabla.filter((t) => t.m.anomalosDetectados > 0 && t.m.precision >= 0.8).map((t) => t.umbral);
    expect(c.umbral).toBe(Math.min(...cumplen));
  });
});
