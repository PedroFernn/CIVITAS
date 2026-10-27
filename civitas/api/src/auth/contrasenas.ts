/** Hash de contraseñas con scrypt (módulo `crypto` de Node: sin dependencias nativas). Formato: scrypt$N$r$p$sal$hash (base64). */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, LARGO = 64;

const derivar = (clave: string, sal: Buffer, n: number, r: number, p: number, largo: number) =>
  new Promise<Buffer>((ok, error) => scrypt(clave, sal, largo, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? error(e) : ok(k))));

export async function hashContrasena(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await derivar(clave, sal, N, R, P, LARGO);
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${h.toString('base64')}`;
}

export async function verificarContrasena(clave: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const obtenido = await derivar(clave, Buffer.from(sal, 'base64'), Number(n), Number(r), Number(p), esperado.length);
  return timingSafeEqual(esperado, obtenido);
}

/** Hash de relleno: se verifica contra él cuando el usuario no existe, para que el tiempo de respuesta no revele qué usuarios existen. */
let relleno: Promise<string> | undefined;
export const hashDeRelleno = () => (relleno ??= hashContrasena('relleno-no-es-una-contrasena'));
