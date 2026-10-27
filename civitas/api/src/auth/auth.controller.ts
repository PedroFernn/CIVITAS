import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, UsuarioSesion } from './auth.service';
import { Roles, SesionGuard, TokenActual, UsuarioActual } from './sesion.guard';
import { parseLogin, parseRegistro } from './validacion-auth';

/** Registro, inicio de sesión y cuenta (P-04, P-11, P-12). La sesión viaja como `Authorization: Bearer <token>`. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('estado')
  @ApiOperation({ summary: '¿Hay cuentas de demostración activas? (la web lo usa para avisarlo)' })
  async estado() {
    await this.auth.sincronizarDemo();
    return { demo: this.auth.demoActivo };
  }

  @Post('registro')
  @ApiOperation({ summary: 'Crea una cuenta (rol usuario) y abre sesión' })
  registro(@Body() body: unknown) {
    return this.auth.registrar(parseRegistro(body));
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión con usuario o correo y contraseña' })
  login(@Body() body: unknown) {
    return this.auth.iniciarSesion(parseLogin(body));
  }

  @Get('me')
  @UseGuards(SesionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cuenta de la sesión actual' })
  me(@UsuarioActual() u: UsuarioSesion) {
    return u;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SesionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cierra la sesión actual' })
  async logout(@TokenActual() token: string) {
    await this.auth.cerrarSesion(token);
    return { ok: true };
  }
}

/** Panel de administración (P-10). Solo rol administrador. */
@ApiTags('admin')
@Controller('admin')
@UseGuards(SesionGuard)
@Roles('administrador')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly auth: AuthService) {}

  @Get('resumen')
  @ApiOperation({ summary: 'Cuentas y sesiones (sin contraseñas ni correos)' })
  resumen() {
    return this.auth.resumenAdmin();
  }
}
