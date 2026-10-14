import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ColoniasService } from './colonias.service';
import { parseFiltros } from './filtros';

const QUERY_DOCS = [
  ['ciudad', 'Ciudad (p. ej. Puebla)'], ['piloto', 'true (por defecto) solo zonas piloto; false todas'],
  ['min_comercios', 'Mínimo de comercios'], ['min_paradas', 'Mínimo de paradas'],
  ['bbox', 'minLon,minLat,maxLon,maxLat'], ['orden', 'nombre | comercios | paradas'],
  ['limit', 'Máx. 200'], ['offset', 'Paginación'],
] as const;

@ApiTags('colonias')
@Controller('colonias')
export class ColoniasController {
  constructor(private readonly svc: ColoniasService) {}

  @Get()
  @ApiOperation({ summary: 'Zonas con atributos (comercios, paradas) y origen del dato — RF-1.1' })
  @ApiQuery({ name: 'ciudad', required: false })
  @ApiQuery({ name: 'piloto', required: false })
  @ApiQuery({ name: 'min_comercios', required: false })
  @ApiQuery({ name: 'min_paradas', required: false })
  @ApiQuery({ name: 'bbox', required: false })
  @ApiQuery({ name: 'orden', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  listar(@Query() q: Record<string, string>) {
    return this.svc.listar(parseFiltros(q));
  }

  // Declarada antes de ':id' para que "geojson" no se interprete como UUID.
  @Get('geojson')
  @ApiOperation({ summary: 'Zonas como FeatureCollection GeoJSON (polígonos + atributos)' })
  geojson(@Query() q: Record<string, string>) {
    return this.svc.geojson(parseFiltros(q, 500));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una zona con su polígono y trazabilidad' })
  detalle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.detalle(id);
  }
}
