import { BadRequestException } from '@nestjs/common';
import { hashContrasena, verificarContrasena } from '../../src/auth/contrasenas';
import { demoHabilitado } from '../../src/auth/demo';
import { LimitadorIntentos } from '../../src/auth/limitador';
import { extraerBearer } from '../../src/auth/sesion.guard';
import { parseLogin, parseRegistro } from '../../src/auth/validacion-auth';

const ok = { usuario: 'Ana_01', correo: ' Ana@Ejemplo.MX ', contrasena: 'clave-larga-1', proposito: 'rentar', acepta_aviso: true };

describe('contraseñas (scrypt)', () => {
  it('no guarda la contraseña en claro; verifica la correcta y rechaza la incorrecta', async () => {
    const h = await hashContrasena('secreta-123');
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(h).not.toContain('secreta-123');
    expect(await verificarContrasena('secreta-123', h)).toBe(true);
    expect(await verificarContrasena('secreta-124', h)).toBe(false);
  });
  it('misma contraseña, hashes distintos (sal aleatoria)', async () => {
    expect(await hashContrasena('x1234567')).not.toBe(await hashContrasena('x1234567'));
  });
  it('un hash corrupto o de otro algoritmo no verifica (ni revienta)', async () => {
    expect(await verificarContrasena('a', 'texto-plano')).toBe(false);
    expect(await verificarContrasena('a', 'bcrypt$1$2$3$4$5')).toBe(false);
  });
});

describe('parseRegistro', () => {
  it('normaliza usuario y correo (minúsculas, sin espacios)', () => {
    expect(parseRegistro(ok)).toEqual({ usuario: 'ana_01', correo: 'ana@ejemplo.mx', contrasena: 'clave-larga-1', proposito: 'rentar' });
  });
  it.each([[undefined], [null], ['']])('propósito ausente o vacío (%j) → otro', (p) => expect(parseRegistro({ ...ok, proposito: p }).proposito).toBe('otro'));
  it('ignora campos no esperados: "rol" nunca llega al resultado', () => {
    expect(parseRegistro({ ...ok, rol: 'administrador', es_demo: true })).not.toHaveProperty('rol');
  });
  it.each([
    ['sin cuerpo', undefined], ['usuario corto', { ...ok, usuario: 'ab' }], ['usuario con espacios', { ...ok, usuario: 'ana perez' }],
    ['usuario con @', { ...ok, usuario: 'ana@x' }], ['correo inválido', { ...ok, correo: 'no-es-correo' }],
    ['contraseña corta', { ...ok, contrasena: '1234567' }], ['contraseña enorme', { ...ok, contrasena: 'a'.repeat(129) }],
    ['contraseña = usuario', { ...ok, usuario: 'anita2026', contrasena: 'ANITA2026' }], ['propósito inválido', { ...ok, proposito: 'hackear' }],
    ['sin aceptar el aviso', { ...ok, acepta_aviso: false }], ['aviso como texto', { ...ok, acepta_aviso: 'true' }],
    ['usuario no es texto', { ...ok, usuario: 123 }], ['texto gigante', { ...ok, correo: 'a'.repeat(400) + '@x.mx' }],
  ])('rechaza: %s', (_n, cuerpo) => expect(() => parseRegistro(cuerpo)).toThrow(BadRequestException));
});

describe('parseLogin', () => {
  it('acepta contraseñas cortas (las cuentas de demostración las tienen)', () => {
    expect(parseLogin({ identificador: ' USR1 ', contrasena: '123' })).toEqual({ identificador: 'usr1', contrasena: '123', recordar: false });
  });
  it('recordar solo con true estricto', () => {
    expect(parseLogin({ identificador: 'a', contrasena: 'b', recordar: true }).recordar).toBe(true);
    expect(parseLogin({ identificador: 'a', contrasena: 'b', recordar: 'true' }).recordar).toBe(false);
  });
  it.each([[undefined], [{}], [{ identificador: '', contrasena: 'x' }], [{ identificador: 'a', contrasena: '' }], [{ identificador: 'a', contrasena: 5 }],
    [{ identificador: 'a', contrasena: 'x'.repeat(129) }]])('rechaza %j', (c) => expect(() => parseLogin(c)).toThrow(BadRequestException));
});

describe('LimitadorIntentos', () => {
  it('bloquea tras 5 fallos y libera al pasar la ventana', () => {
    let t = 0;
    const l = new LimitadorIntentos(5, 1000, () => t);
    for (let i = 0; i < 4; i++) l.fallo('a');
    expect(l.bloqueadoPor('a')).toBe(0);
    l.fallo('a');
    expect(l.bloqueadoPor('a')).toBe(1);
    expect(l.bloqueadoPor('otro')).toBe(0);
    t = 1001;
    expect(l.bloqueadoPor('a')).toBe(0);
  });
  it('un acceso correcto reinicia el contador', () => {
    const l = new LimitadorIntentos(2, 1000, () => 0);
    l.fallo('a'); l.exito('a'); l.fallo('a');
    expect(l.bloqueadoPor('a')).toBe(0);
  });
});

describe('extraerBearer', () => {
  it('solo acepta "Bearer <token>"', () => {
    expect(extraerBearer('Bearer abc_DEF-123')).toBe('abc_DEF-123');
    for (const h of [undefined, '', 'abc', 'Basic abc', 'Bearer', 'Bearer a b', 'bearer abc']) expect(extraerBearer(h)).toBeNull();
  });
});

describe('demoHabilitado (seguro por defecto)', () => {
  it.each([
    [{}, true, 'sin nada definido = desarrollo local'],
    [{ WEB_ORIGIN: 'http://localhost' }, true, 'compose local'],
    [{ WEB_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000' }, true, 'varios orígenes locales'],
    [{ WEB_ORIGIN: 'https://civitas.mx' }, false, 'dominio real: apagado'],
    [{ WEB_ORIGIN: 'http://localhost,https://civitas.mx' }, false, 'basta un origen público para apagarlo'],
    [{ WEB_ORIGIN: 'https://civitas.mx', DEMO_USERS: '1' }, true, 'encendido explícito'],
    [{ WEB_ORIGIN: 'http://localhost', DEMO_USERS: '0' }, false, 'apagado explícito'],
    [{ WEB_ORIGIN: 'https://localhost.evil.com' }, false, 'no basta empezar por "localhost"'],
    [{ WEB_ORIGIN: 'http://localhost.evil.com:80' }, false, 'tampoco con puerto'],
    [{ DEMO_USERS: 'true' }, true, 'valor no reconocido → cae al criterio local'],
  ])('%j → %s (%s)', (env, esperado, _motivo) => expect(demoHabilitado(env as NodeJS.ProcessEnv)).toBe(esperado));
});
