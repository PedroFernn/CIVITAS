import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Db } from './db';
import { ZonaDto } from './zona.dto';

@ApiTags('zonas')
@Controller('zonas')
export class ZonasController {
  constructor(private readonly db: Db) {}

  // RF-1.1 (base): lista pública de zonas publicadas. Sin datos personales.
  @Get()
  @ApiOperation({ summary: 'Lista las zonas publicadas', description: 'Solo zonas con estado "publicada", ordenadas por ciudad y nombre. Un filtro sin coincidencias devuelve [] (200).' })
  @ApiQuery({ name: 'ciudad', required: false, description: 'Igualdad exacta (distingue mayúsculas y acentos).', example: 'Puebla' })
  @ApiOkResponse({ type: ZonaDto, isArray: true })
  listar(@Query('ciudad') ciudad?: string) {
    return this.db.query(
      `SELECT id, nombre, ciudad,
              indice_asequibilidad::float8 AS "indiceAsequibilidad",
              ST_X(coordenadas) AS lng, ST_Y(coordenadas) AS lat,
              actualizado_en AS "actualizadoEn"
         FROM zonas
        WHERE estado = 'publicada' AND ($1::text IS NULL OR ciudad = $1)
        ORDER BY ciudad, nombre`,
      [ciudad ?? null],
    );
  }
}
