/** Pruebas unitarias de MVP-3 sin base de datos: normalización, parser aislado, privacidad y lectura del ADR-002. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluarAdr, leerAdr } from '../../src/etl/renta/adr';
import { capturaManual, detectarColumnasSensibles } from '../../src/etl/renta/fuentes/captura-manual';
import {
  aNumero, huella, normalizarFecha, normalizarPrecio, normalizarRecamaras, normalizarSuperficie, normalizarTipo, sanitizarUrl,
} from '../../src/etl/renta/normalizar';
import { obtenerParser, PARSERS } from '../../src/etl/renta/registro';
import { ADR_FUENTE_RENTA } from '../../src/etl/config';
import { AvisosLectura } from '../../src/etl/renta/tipos';

const tmp = () => mkdtempSync(path.join(tmpdir(), 'civitas-renta-'));
const todo = async <T>(g: AsyncGenerator<T>) => { const o: T[] = []; for await (const x of g) o.push(x); return o; };
const precio = (t: string | null, m: string | null = null) => normalizarPrecio(t, m, 1000, 250000);

describe('aNumero', () => {
  it.each([['12500', 12500], ['12,500', 12500], ['12,500.50', 12500.5], ['12 500', 12500], ['65,5', 65.5], ['1.250,50', 1250.5], ['65.5', 65.5]])(
    '%s → %s', (t, n) => expect(aNumero(t)).toBe(n));
  it.each([['abc'], [''], ['12-13'], ['1,2,3']])('%s → null', (t) => expect(aNumero(t)).toBeNull());
});

describe('normalizarPrecio', () => {
  it.each([['8500', 8500], ['8,500', 8500], ['$8,500', 8500], ['$ 8,500.00 MXN', 8500], ['8500 mensuales', 8500], ['$12,000 /mes', 12000], ['8500 pesos', 8500]])(
    'acepta %s', (t, n) => expect(precio(t)).toEqual({ ok: true, valor: n }));
  it('motivos de rechazo', () => {
    expect(precio(null)).toEqual({ ok: false, motivo: 'precio faltante' });
    expect(precio('  ')).toEqual({ ok: false, motivo: 'precio faltante' });
    expect(precio('consultar')).toEqual({ ok: false, motivo: 'precio no numérico' });
    expect(precio('1,200 USD')).toEqual({ ok: false, motivo: 'moneda no soportada (USD)' });
    expect(precio('900', 'usd')).toEqual({ ok: false, motivo: 'moneda no soportada (USD)' });
    expect(precio('900', 'EUR')).toEqual({ ok: false, motivo: 'moneda no soportada (EUR)' });
    expect(precio('120')).toEqual({ ok: false, motivo: 'precio fuera de rango (120)' });
    expect(precio('9999999')).toEqual({ ok: false, motivo: 'precio fuera de rango (9999999)' });
  });
  it('"12.500" se lee como 12.5 y el rango lo marca (en México el punto es decimal)', () => {
    expect(precio('12.500')).toEqual({ ok: false, motivo: 'precio fuera de rango (12.5)' });
  });
  it('acepta moneda MXN en su columna', () => expect(precio('8500', 'MXN')).toEqual({ ok: true, valor: 8500 }));
});

describe('normalizarSuperficie', () => {
  it.each([['65', 65], ['65 m2', 65], ['65m²', 65], ['65.5 mts2', 65.5], ['65,5 m²', 65.5], ['120 metros cuadrados', 120]])(
    'acepta %s', (t, n) => expect(normalizarSuperficie(t)).toEqual({ ok: true, valor: n }));
  it('rechaza con motivo', () => {
    expect(normalizarSuperficie(null)).toEqual({ ok: false, motivo: 'superficie faltante' });
    expect(normalizarSuperficie('amplio')).toEqual({ ok: false, motivo: 'superficie no numérica' });
    expect(normalizarSuperficie('3')).toEqual({ ok: false, motivo: 'superficie fuera de rango (3)' });
  });
});

describe('normalizarRecamaras', () => {
  it.each([['2', 2], ['2 rec', 2], ['3 recámaras', 3], ['3+', 3], ['4 o más', 4], ['estudio', 0], ['Studio', 0], ['Loft', 0], ['0', 0]])(
    'acepta %s', (t, n) => expect(normalizarRecamaras(t)).toEqual({ ok: true, valor: n }));
  it('rechaza con motivo', () => {
    expect(normalizarRecamaras(null)).toEqual({ ok: false, motivo: 'recámaras faltantes' });
    expect(normalizarRecamaras('varias')).toEqual({ ok: false, motivo: 'recámaras no numéricas' });
    expect(normalizarRecamaras('25')).toEqual({ ok: false, motivo: 'recámaras fuera de rango (25)' });
  });
});

describe('normalizarTipo / normalizarFecha / sanitizarUrl', () => {
  it('tipo', () => {
    expect(normalizarTipo('Departamento')).toBe('departamento');
    expect(normalizarTipo('Depto. en torre')).toBe('departamento');
    expect(normalizarTipo('Casa sola')).toBe('casa');
    expect(normalizarTipo('Habitación')).toBe('cuarto');
    expect(normalizarTipo('Bodega')).toBe('otro');
    expect(normalizarTipo(null)).toBe('otro');
  });
  it('fecha', () => {
    const hoy = new Date('2026-10-17T12:00:00Z');
    expect(normalizarFecha('2026-10-03', hoy)).toBe('2026-10-03');
    expect(normalizarFecha('2026-10', hoy)).toBe('2026-10-01');
    expect(normalizarFecha('03/10/2026', hoy)).toBe('2026-10-03');
    expect(normalizarFecha('2026-10-03T10:20:00Z', hoy)).toBe('2026-10-03');
    expect(normalizarFecha('2026-02-30', hoy)).toBeNull();   // no existe
    expect(normalizarFecha('2027-01-01', hoy)).toBeNull();   // futura
    expect(normalizarFecha('ayer', hoy)).toBeNull();
    expect(normalizarFecha(null, hoy)).toBeNull();
  });
  it('url: quita query/fragmento y descarta enlaces de contacto', () => {
    expect(sanitizarUrl('https://ejemplo.invalid/a/1?utm=x&tel=5512345678#c')).toBe('https://ejemplo.invalid/a/1');
    expect(sanitizarUrl('https://wa.me/5212221234567')).toBeNull();
    expect(sanitizarUrl('https://api.whatsapp.com/send?phone=1')).toBeNull();
    expect(sanitizarUrl('mailto:a@b.mx')).toBeNull();
    expect(sanitizarUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizarUrl('https://user:pw@ejemplo.invalid/a')).toBeNull();
    expect(sanitizarUrl('no es url')).toBeNull();
    expect(sanitizarUrl(null)).toBeNull();
  });
});

describe('huella', () => {
  const base = { tipo: 'departamento' as const, precio: 9000, superficie: 60, recamaras: 2, lat: 19.04123, lon: -98.21098 };
  it('misma oferta (a ~11 m) → misma huella; cambia con el precio o el tipo', () => {
    expect(huella(base)).toBe(huella({ ...base, lat: 19.041231, lon: -98.210984 }));
    expect(huella(base)).not.toBe(huella({ ...base, precio: 9500 }));
    expect(huella(base)).not.toBe(huella({ ...base, tipo: 'casa' }));
    expect(huella(base)).not.toBe(huella({ ...base, lat: 19.0423 }));
  });
});

describe('parser captura_manual (aislado, sin datos personales)', () => {
  it('está registrado y se obtiene por clave; una clave desconocida da error claro', () => {
    expect(PARSERS.get('renta_captura_manual')).toBe(capturaManual);
    expect(obtenerParser('renta_captura_manual')).toBe(capturaManual);
    expect(() => obtenerParser('otro')).toThrow(/^MVP-3: no hay un parser registrado/);
  });

  it('lee solo los campos del contrato; teléfono y anunciante ni salen del parser y se avisan', async () => {
    const f = path.join(tmp(), 'r.csv');
    writeFileSync(f, [
      'id_anuncio,url,tipo,precio,moneda,superficie_m2,recamaras,latitud,longitud,fecha_publicacion,telefono,Nombre Anunciante,descripcion',
      'A1,https://x.invalid/a1,Depto,"$9,000",MXN,60 m2,2,19.04,-98.21,2026-10-01,2221234567,Juan Pérez,Llamar al 2221234567',
    ].join('\n'), 'utf8');
    const avisos: AvisosLectura = { columnasSensibles: [] };
    const [l] = await todo(capturaManual.leer(f, avisos));
    expect(l).toEqual({ fila: 2, idFuente: 'A1', url: 'https://x.invalid/a1', tipo: 'Depto', precio: '$9,000', moneda: 'MXN',
      superficie: '60 m2', recamaras: '2', lat: '19.04', lon: '-98.21', publicado: '2026-10-01' });
    expect(JSON.stringify(l)).not.toMatch(/2221234567|Juan/);
    expect(avisos.columnasSensibles).toEqual(['telefono', 'nombre_anunciante', 'descripcion']);
  });

  it('acepta alias de columnas y encabezados en otro orden o con acentos', async () => {
    const f = path.join(tmp(), 'r.csv');
    writeFileSync(f, 'Renta,ID,Lat,Lng,Recámaras,M2\n8500,B7,19.0,-98.2,1,40\n', 'utf8');
    const [l] = await todo(capturaManual.leer(f, { columnasSensibles: [] }));
    expect(l).toMatchObject({ idFuente: 'B7', precio: '8500', lat: '19.0', lon: '-98.2', recamaras: '1', superficie: '40' });
  });

  it('detectarColumnasSensibles: no marca las columnas legítimas', () => {
    expect(detectarColumnasSensibles(['id_anuncio', 'url', 'tipo', 'tipo_inmueble', 'precio', 'superficie_m2', 'latitud', 'longitud'])).toEqual([]);
    expect(detectarColumnasSensibles(['celular', 'whatsapp', 'contacto', 'agente', 'inmobiliaria', 'correo', 'notas'])).toHaveLength(7);
  });
});

describe('ADR-002', () => {
  it('el ADR entregado tiene decisión válida y aún no tiene la revisión de términos (hay que hacerla)', () => {
    const e = evaluarAdr(leerAdr(ADR_FUENTE_RENTA));
    expect(e.existe).toBe(true);
    expect(e.decision).toBe('captura_manual');
    expect(e.aceptada).toBe(false);
    expect(e.faltanTerminos).toEqual(['portal', 'terminos_url', 'terminos_revisados_en', 'terminos_revisados_por', 'terminos_permiten_uso']);
  });

  it('campos completos → revisión válida; los comentarios no cuentan como valor', () => {
    const f = path.join(tmp(), 'adr.md');
    writeFileSync(f, ['---', 'estado: aceptada # ok', 'decision: scraping', 'portal: Portal X', 'terminos_url: https://x.mx/terminos',
      'terminos_revisados_en: 2026-10-16', 'terminos_revisados_por: Ana', 'terminos_permiten_uso: sí', '---', 'texto'].join('\n'));
    const e = evaluarAdr(leerAdr(f));
    expect(e).toMatchObject({ decision: 'scraping', aceptada: true, faltanTerminos: [], terminosPermiten: true });
  });

  it('decisión inválida, fecha imposible y "no" se detectan; archivo ausente no revienta', () => {
    const f = path.join(tmp(), 'adr.md');
    writeFileSync(f, ['---', 'decision: telepatía', 'portal: P', 'terminos_url: ftp://x', 'terminos_revisados_en: 2026-02-31',
      'terminos_revisados_por: A', 'terminos_permiten_uso: no', '---'].join('\n'));
    const e = evaluarAdr(leerAdr(f));
    expect(e.decision).toBeNull();
    expect(e.faltanTerminos).toEqual(['terminos_url', 'terminos_revisados_en']);
    expect(e.terminosPermiten).toBe(false);
    expect(evaluarAdr(leerAdr(path.join(tmp(), 'no-existe.md')))).toMatchObject({ existe: false, decision: null });
  });
});
