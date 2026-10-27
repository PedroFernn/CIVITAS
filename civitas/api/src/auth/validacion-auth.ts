import { BadRequestException } from '@nestjs/common';

export const ROLES = ['usuario', 'administrador'] as const;
export type Rol = (typeof ROLES)[number];
export const PROPOSITOS = ['rentar', 'comprar', 'otro'] as const;

const USUARIO = /^[a-z0-9_.-]{3,30}$/;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MIN_CONTRASENA = 8;
export const MAX_CONTRASENA = 128; // evita que una contraseña enorme se use para agotar CPU con scrypt

const texto = (v: unknown, campo: string, max: number): string => {
  if (typeof v !== 'string') throw new BadRequestException(`${campo} es obligatorio`);
  if (v.length > max) throw new BadRequestException(`${campo} es demasiado largo`);
  return v;
};

export interface DatosRegistro { usuario: string; correo: string; contrasena: string; proposito: (typeof PROPOSITOS)[number] }
export interface DatosLogin { identificador: string; contrasena: string; recordar: boolean }

/** Solo se leen los campos esperados: cualquier otro (p. ej. "rol") se ignora, así nadie puede crearse como administrador. */
export function parseRegistro(b: any): DatosRegistro {
  const cuerpo = b && typeof b === 'object' ? b : {};
  const usuario = texto(cuerpo.usuario, 'usuario', 100).trim().toLowerCase();
  if (!USUARIO.test(usuario)) throw new BadRequestException('usuario: 3 a 30 caracteres (letras, números, punto, guion o guion bajo)');
  const correo = texto(cuerpo.correo, 'correo', 300).trim().toLowerCase();
  if (correo.length > 254 || !CORREO.test(correo)) throw new BadRequestException('correo no válido');
  const contrasena = texto(cuerpo.contrasena, 'contrasena', 1000);
  if (contrasena.length < MIN_CONTRASENA) throw new BadRequestException(`La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres`);
  if (contrasena.length > MAX_CONTRASENA) throw new BadRequestException(`La contraseña no puede pasar de ${MAX_CONTRASENA} caracteres`);
  if (contrasena.toLowerCase() === usuario || contrasena.toLowerCase() === correo) throw new BadRequestException('La contraseña no puede ser igual al usuario o al correo');
  const proposito = cuerpo.proposito == null || cuerpo.proposito === '' ? 'otro' : cuerpo.proposito;
  if (!(PROPOSITOS as readonly string[]).includes(proposito)) throw new BadRequestException(`proposito debe ser ${PROPOSITOS.join('|')}`);
  if (cuerpo.acepta_aviso !== true) throw new BadRequestException('Debes aceptar el aviso de privacidad para crear una cuenta');
  return { usuario, correo, contrasena, proposito };
}

/** En el login no se aplica la política de longitud mínima (las cuentas de demostración tienen contraseñas cortas). */
export function parseLogin(b: any): DatosLogin {
  const cuerpo = b && typeof b === 'object' ? b : {};
  const identificador = texto(cuerpo.identificador, 'identificador', 300).trim().toLowerCase();
  const contrasena = texto(cuerpo.contrasena, 'contrasena', 1000);
  if (!identificador || !contrasena) throw new BadRequestException('Escribe tu usuario y tu contraseña');
  if (contrasena.length > MAX_CONTRASENA) throw new BadRequestException('Usuario o contraseña incorrectos');
  return { identificador, contrasena, recordar: cuerpo.recordar === true };
}
