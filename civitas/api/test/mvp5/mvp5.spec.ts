import { simularUsuarios, percentil } from '../../src/etl/mvp5/carga';
import { evaluarEntrevistas } from '../../src/etl/mvp5/validacion';
import { armarComparacion, parseIdsComparacion } from '../../src/zonas/comparar';
import { parseEntrevista, resumirEntrevistas } from '../../src/entrevistas/validacion-entrevistas';

const nota = 'Paga ocho mil quinientos y le parece caro por la distancia al metro.';
const fila = (tipo: 'inquilino' | 'b2b', notas: string | null = nota, acepta: boolean | null = null) => ({ tipo, notas, acepta_pagar: acepta });

describe('MVP-5 · prueba de carga', () => {
  it('lanza todos los usuarios a la vez y mide cada acción', async () => {
    let simultaneas = 0, maximo = 0;
    const r = await simularUsuarios(50, async (_i, medir) => {
      for (let k = 0; k < 3; k++) {
        await medir(async () => { simultaneas++; maximo = Math.max(maximo, simultaneas); await new Promise((ok) => setTimeout(ok, 5)); simultaneas--; });
      }
    });
    expect(r).toMatchObject({ usuarios: 50, solicitudes: 150, errores: 0 });
    expect(maximo).toBe(50);
    expect(r.p95_ms).toBeGreaterThanOrEqual(r.p50_ms);
    expect(r.solicitudes_por_s).toBeGreaterThan(0);
  });

  it('un error no detiene a los demás: se cuenta y la sesión sigue', async () => {
    const r = await simularUsuarios(10, async (i, medir) => {
      await medir(async () => { if (i % 2) throw new Error('boom'); });
      await medir(async () => 1);
    });
    expect(r).toMatchObject({ solicitudes: 20, errores: 5, primer_error: 'boom' });
  });

  it('percentil por rango más cercano', () => {
    expect(percentil([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentil(Array.from({ length: 100 }, (_, i) => i + 1), 0.95)).toBe(95);
    expect(percentil([], 0.95)).toBe(0);
  });
});

describe('MVP-5 · checklist de entrevistas', () => {
  const cinco = [fila('inquilino'), fila('inquilino'), fila('inquilino'), fila('b2b', nota, true), fila('b2b', nota, false)];
  it('3 inquilinos + 2 B2B con notas → ok, y reporta cuántos B2B pagarían', () => {
    const r = evaluarEntrevistas(cinco);
    expect(r.estado).toBe('ok');
    expect(r.detalle).toContain('3/3');
    expect(r.detalle).toContain('1 de 2');
  });
  it('faltan entrevistas → fail y dice cuáles', () => {
    const r = evaluarEntrevistas(cinco.slice(1, 4));
    expect(r.estado).toBe('fail');
    expect(r.detalle).toContain('faltan 1 inquilino(s)');
    expect(r.detalle).toContain('1 inmobiliaria(s)');
  });
  it('las entrevistas sin notas no cuentan («notas guardadas»)', () => {
    expect(evaluarEntrevistas([...cinco.slice(0, 4), fila('b2b', null)]).estado).toBe('fail');
    expect(evaluarEntrevistas([...cinco.slice(0, 4), fila('b2b', '  corta ')]).estado).toBe('fail');
  });
  it('más de las necesarias también pasa', () => {
    expect(evaluarEntrevistas([...cinco, fila('b2b'), fila('inquilino')]).estado).toBe('ok');
    expect(resumirEntrevistas([...cinco, fila('b2b')]).por_tipo.b2b.hechas).toBe(3);
  });
});

describe('MVP-5 · parseEntrevista', () => {
  const base = { tipo: 'b2b', alias: 'Inmobiliaria 1', realizada_en: '2026-11-03', notas: nota };
  it('acepta números como texto (formularios) y normaliza vacíos a null', () => {
    const e = parseEntrevista({ ...base, renta_justa_mxn: '7500', duracion_min: '', zona_id: '', acepta_pagar: true, monto_dispuesto_mxn: '99' });
    expect(e).toMatchObject({ renta_justa_mxn: 7500, duracion_min: null, zona_id: null, acepta_pagar: true, monto_dispuesto_mxn: 99, modalidad: 'presencial' });
  });
  it('rechaza lo que no es un objeto', () => {
    for (const x of [null, 'texto', [], 5]) expect(() => parseEntrevista(x)).toThrow();
  });
});

describe('MVP-5 · parseIdsComparacion', () => {
  const U = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
  it('acepta de 1 a 3, conserva el orden y acepta ?items=a&items=b', () => {
    expect(parseIdsComparacion(`${U(2)}, ${U(1)}`)).toEqual([U(2), U(1)]);
    expect(parseIdsComparacion([U(1), U(2)])).toEqual([U(1), U(2)]);
  });
  it('rechaza 0 o más de 3', () => {
    expect(() => parseIdsComparacion(undefined)).toThrow('obligatorio');
    expect(() => parseIdsComparacion([U(1), U(2), U(3), U(4)].join(','))).toThrow('hasta 3');
  });
  it('armarComparacion no divide entre cero ni inventa diferencias', () => {
    const r = armarComparacion([{ id: 'a', ciudad: 'X', renta_mediana: 100, area_km2: 0, num_paradas: 3, lugar: null, de: null }], [{ ciudad: 'X', n_listados: 1, zonas: 1, renta_mediana: null, precio_m2_mediano: null }], 5);
    expect(r.items[0]).toMatchObject({ paradas_por_km2: null, renta_vs_ciudad_pct: null, posicion_precio_m2: null });
  });
});
