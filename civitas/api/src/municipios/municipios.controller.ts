import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MunicipiosService } from './municipios.service';

@ApiTags('municipios')
@Controller('municipios')
export class MunicipiosController {
  constructor(private readonly svc: MunicipiosService) {}

  @Get()
  @ApiOperation({ summary: 'Municipios con zonas, con su población del Censo 2020 (INEGI)' })
  listar() {
    return this.svc.listar();
  }

  // La ruta fija va antes de cualquier ruta con parámetro.
  @Get('geojson')
  @ApiOperation({ summary: 'Contorno de los municipios como FeatureCollection GeoJSON (forma del estado)' })
  @ApiQuery({ name: 'simplificar', required: false, description: 'Tolerancia en grados, de 0 (sin simplificar) a 0.05; por defecto 0.002 (~220 m)' })
  geojson(@Query('simplificar') simplificar?: string) {
    const t = simplificar === undefined ? 0.002 : Number(simplificar);
    if (!(Number.isFinite(t) && t >= 0 && t <= 0.05)) throw new BadRequestException('simplificar debe estar entre 0 y 0.05 (grados)');
    return this.svc.geojson(t);
  }
}
