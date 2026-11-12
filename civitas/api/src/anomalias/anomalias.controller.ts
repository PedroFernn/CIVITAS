import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnomaliasService } from './anomalias.service';

@ApiTags('anomalias')
@Controller('anomalias')
export class AnomaliasController {
  constructor(private readonly svc: AnomaliasService) {}

  @Get('resumen')
  @ApiOperation({ summary: 'Motor de anomalías v1: cuántos listados son justos, inflados o de subprecio, el umbral usado y el último checklist de MVP-6' })
  async resumen() {
    const r = await this.svc.resumen();
    if (!r) throw new NotFoundException('Aún no hay anomalías calculadas: ejecuta `docker compose run --rm etl mvp6`');
    return r;
  }
}
