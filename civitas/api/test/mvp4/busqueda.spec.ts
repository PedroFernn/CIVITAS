import { escaparLike, normalizar, ordenarPorRelevancia, puntuar, terminos } from '../../src/zonas/busqueda';
import { parseFiltrosZonas } from '../../src/zonas/filtros-zonas';
import { medianaManual } from '../../src/etl/mvp4/validacion';

const Z = (nombre: string, clave: string | null = null, n = 0) => ({ nombre, clave_geo: clave, ciudad: 'Puebla', n_listados: n });

describe('búsqueda de zonas (puro)', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalizar('AGEB Sintético ÑÚ')).toBe('ageb sintetico nu');
    expect(terminos('  Sintético   04 ')).toEqual(['sintetico', '04']);
    expect(terminos('   ')).toEqual([]);
    expect(terminos(undefined)).toEqual([]);
  });

  it('limita el largo y el número de términos', () => {
    expect(terminos('a'.repeat(500))[0]).toHaveLength(60);
    expect(terminos('a b c d e f g h')).toHaveLength(6);
  });

  it('escapa los comodines de LIKE', () => {
    expect(escaparLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  it('un número suelto coincide con la palabra numérica aunque tenga ceros: "4" → "04" antes que "14" o "40"', () => {
    const zonas = [Z('AGEB sintético 14'), Z('AGEB sintético 40'), Z('AGEB sintético 04'), Z('AGEB sintético 24')];
    expect(ordenarPorRelevancia(zonas, ['4'])[0].nombre).toBe('AGEB sintético 04');
    expect(puntuar(Z('AGEB sintético 04'), ['4'])).toBe(90);
  });

  it('un número corto no coincide con la clave: «4» no trae las zonas cuyo CVEGEO contiene «114»', () => {
    const z = Z('AGEB sintético 22', '21114FX0022');
    expect(puntuar(z, ['4'])).toBe(0);
    expect(puntuar(z, ['114'])).toBe(0);
    expect(puntuar(z, ['21114'])).toBe(80);        // 5 dígitos: ya es una clave parcial
    expect(puntuar(Z('AGEB sintético 114'), ['114'])).toBe(90);
  });

  it('el CVEGEO exacto gana, el prefijo va después y la coincidencia parcial al final', () => {
    const zonas = [Z('AGEB sintético 02', '2111400010029'), Z('AGEB sintético 01', '2111400010014'), Z('AGEB sintético 03', '2111400020030')];
    expect(ordenarPorRelevancia(zonas, ['2111400010014'])[0].nombre).toBe('AGEB sintético 01');
    expect(puntuar(zonas[0], ['21114000100'])).toBe(80);
    expect(puntuar(zonas[0], ['0029'])).toBe(40);
  });

  it('con varios términos promedia; un término que no está puntúa 0', () => {
    expect(puntuar(Z('AGEB sintético 04'), ['sintetico', '04'])).toBeCloseTo((60 + 90) / 2);
    expect(puntuar(Z('AGEB sintético 04'), ['zzz'])).toBe(0);
    expect(puntuar(Z('AGEB sintético 04'), [])).toBe(0);
  });

  it('a igualdad de puntaje: más listados primero, luego nombre natural', () => {
    const zonas = [Z('AGEB sintético 10', null, 3), Z('AGEB sintético 02', null, 9), Z('AGEB sintético 01', null, 9)];
    expect(ordenarPorRelevancia(zonas, ['sintetico']).map((z) => z.nombre)).toEqual(['AGEB sintético 01', 'AGEB sintético 02', 'AGEB sintético 10']);
  });
});

describe('filtros de /zonas', () => {
  it('con q ordena por relevancia; sin q, por nombre', () => {
    expect(parseFiltrosZonas({ q: 'sintético' }).orden).toBe('relevancia');
    expect(parseFiltrosZonas({}).orden).toBe('nombre');
    expect(parseFiltrosZonas({ q: 'x' }).q).toEqual(['x']);
  });

  it('un rango de renta implica solo zonas con precio publicable', () => {
    expect(parseFiltrosZonas({ min_renta: '5000' }).conPrecio).toBe(true);
    expect(parseFiltrosZonas({}).conPrecio).toBe(false);
  });

  it.each([
    [{ orden: 'relevancia' }], [{ orden: 'precio;DROP' }], [{ piloto: 'quizas' }], [{ con_precio: 'si' }],
    [{ min_renta: '9', max_renta: '3' }], [{ limit: '0' }], [{ limit: '9999' }], [{ offset: '-1' }], [{ q: 'a'.repeat(200) }],
  ])('rechaza %j', (q) => {
    expect(() => parseFiltrosZonas(q as any)).toThrow();
  });
});

describe('mediana manual', () => {
  it('impar, par y vacío', () => {
    expect(medianaManual([3, 1, 2])).toBe(2);
    expect(medianaManual([4, 1, 3, 2])).toBe(2.5);
    expect(medianaManual([])).toBeNull();
  });
});
