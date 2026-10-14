import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

/** Trazabilidad pública (RNF): qué fuente, desde qué archivo, cuándo y cuántos registros. Sin datos personales. */
@ApiTags('datos-abiertos')
@Controller('datos-abiertos')
export class DatosAbiertosController {
  constructor(private readonly db: DatabaseService) {}

  @Get('fuentes')
  @ApiOperation({ summary: 'Catálogo de fuentes y estado de su última carga (UC-A1.1)' })
  fuentes() {
    return this.db.query(
      `SELECT f.clave, f.nombre, f.descripcion, f.url, f.licencia, COALESCE(f.estado,'sin_cargar') AS estado, f.ultima_ingesta,
              u.id AS ultima_carga_id, u.modo, u.registros_cargados, u.registros_descartados
       FROM fuentes_datos f
       LEFT JOIN LATERAL (SELECT * FROM cargas_datos c WHERE c.fuente_clave = f.clave ORDER BY c.id DESC LIMIT 1) u ON TRUE
       ORDER BY f.id`);
  }

  @Get('cargas')
  @ApiOperation({ summary: 'Historial de cargas (fuente, archivo, SHA-256, fecha, conteos)' })
  cargas(@Query('fuente') fuente?: string, @Query('limit') limit = '20') {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new BadRequestException('limit debe ser entero entre 1 y 100');
    return this.db.query(
      `SELECT id, fuente_clave, modo, estado, archivo_origen, sha256, version_fuente, iniciada_en, finalizada_en,
              registros_leidos, registros_cargados, registros_descartados, error
       FROM cargas_datos WHERE ($1::text IS NULL OR fuente_clave = $1) ORDER BY id DESC LIMIT $2`, [fuente ?? null, n]);
  }

  @Get('validacion')
  @ApiOperation({ summary: 'Último resultado del checklist "Para pasar" de MVP-2' })
  async validacion() {
    const [r] = await this.db.query(
      'SELECT id, ejecutada_en, aprobada, modo, resultados FROM mvp2_validaciones ORDER BY id DESC LIMIT 1');
    if (!r) throw new NotFoundException('Aún no hay validaciones: ejecuta `docker compose run --rm etl mvp2`');
    return r;
  }
}
