import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, UsuarioSesion } from './auth.service';
import { Rol } from './validacion-auth';

export const ROLES_KEY = 'roles';
/** Restringe una ruta a ciertos roles (siempre junto con @UseGuards(SesionGuard)). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export const extraerBearer = (h: string | undefined): string | null => {
  const m = /^Bearer ([A-Za-z0-9_-]+)$/.exec(h ?? '');
  return m ? m[1] : null;
};

/** 401 sin sesión válida · 403 con sesión pero sin el rol requerido. Deja `req.usuario` y `req.token`. */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = extraerBearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Inicia sesión para continuar');
    const usuario = await this.auth.usuarioPorToken(token);
    if (!usuario) throw new UnauthorizedException('Tu sesión no es válida o expiró');
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(usuario.rol)) throw new ForbiddenException('No tienes permiso para esta sección');
    req.usuario = usuario;
    req.token = token;
    return true;
  }
}

export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioSesion => ctx.switchToHttp().getRequest().usuario);
export const TokenActual = createParamDecorator((_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest().token);
