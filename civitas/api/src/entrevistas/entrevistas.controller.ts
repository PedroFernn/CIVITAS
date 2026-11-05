import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuarioSesion } from '../auth/auth.service';
import { Roles, SesionGuard, UsuarioActual } from '../auth/sesion.guard';
import { EntrevistasService } from './entrevistas.service';
import { parseEntrevista } from './validacion-entrevistas';

/** MVP-5 · entrevistas de precio. Solo administradores: guardan notas de negocio (con alias, sin datos personales). */
@ApiTags('entrevistas')
@Controller('entrevistas')
@UseGuards(SesionGuard)
@Roles('administrador')
@ApiBearerAuth()
export class EntrevistasController {
  constructor(private readonly svc: EntrevistasService) {}

  @Get()
  @ApiOperation({ summary: 'Entrevistas con su avance contra el objetivo (3 inquilinos + 2 B2B, con notas)' })
  listar() {
    return this.svc.listar();
  }

  // Las rutas fijas van antes de ':id'.
  @Get('validacion')
  @ApiOperation({ summary: 'Último resultado del checklist \"Para pasar\" de MVP-5' })
  async validacion() {
    const r = await this.svc.ultimaValidacion();
    if (!r) throw new NotFoundException('Aún no hay validaciones de MVP-5: ejecuta `docker compose run --rm etl mvp5`');
    return r;
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una entrevista (alias, no nombre; sin correo ni teléfono)' })
  crear(@Body() body: unknown, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.crear(parseEntrevista(body), u.usuario);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Corregir una entrevista' })
  actualizar(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.svc.actualizar(id, parseEntrevista(body));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una entrevista' })
  async eliminar(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.eliminar(id);
  }
}
