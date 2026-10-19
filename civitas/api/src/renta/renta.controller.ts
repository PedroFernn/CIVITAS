import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { entero } from '../colonias/filtros';
import { parseFiltrosListados } from './filtros-renta';
import { RentaService } from './renta.service';

/** MVP-3 · precios de renta (solo lectura). Sin datos personales: no se almacenan teléfono ni nombre del anunciante. */
@ApiTags('renta')
@Controller('listados-renta')
export class RentaController {
  constructor(private readonly svc: RentaService) {}

  @Get()
  @ApiOperation({ summary: 'Listados de renta normalizados (precio, m², recámaras, coordenadas) con su zona — RF-1.2' })
  @ApiQuery({ name: 'zona_id', required: false })
  @ApiQuery({ name: 'con_zona', required: false })
  @ApiQuery({ name: 'tipo', required: false })
  @ApiQuery({ name: 'recamaras', required: false })
  @ApiQuery({ name: 'min_precio', required: false })
  @ApiQuery({ name: 'max_precio', required: false })
  @ApiQuery({ name: 'orden', required: false, description: 'reciente | precio | precio_m2' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máx. 200' })
  @ApiQuery({ name: 'offset', required: false })
  listar(@Query() q: Record<string, string>) {
    return this.svc.listar(parseFiltrosListados(q));
  }

  // Las rutas fijas van antes de cualquier ruta con parámetro.
  @Get('resumen-zonas')
  @ApiOperation({ summary: 'Renta mediana y cuartiles por zona (se suprimen con menos de 5 listados)' })
  @ApiQuery({ name: 'limit', required: false })
  resumenZonas(@Query('limit') limit?: string) {
    return this.svc.resumenZonas(entero(limit, 'limit', 1, 500) ?? 100);
  }

  @Get('calidad')
  @ApiOperation({ summary: 'Reporte de calidad de la última carga de listados' })
  async calidad() {
    const r = await this.svc.ultimoReporte();
    if (!r) throw new NotFoundException('Aún no hay reporte de calidad: ejecuta `docker compose run --rm etl mvp3`');
    return r;
  }

  @Get('validacion')
  @ApiOperation({ summary: 'Último resultado del checklist "Para pasar" de MVP-3' })
  async validacion() {
    const r = await this.svc.ultimaValidacion();
    if (!r) throw new NotFoundException('Aún no hay validaciones de MVP-3: ejecuta `docker compose run --rm etl mvp3`');
    return r;
  }
}
