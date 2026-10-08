import { ApiProperty } from '@nestjs/swagger';

export class ZonaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Centro Histórico' })
  nombre!: string;

  @ApiProperty({ example: 'Puebla' })
  ciudad!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'renta_mediana / ingreso_mediano. Nulo mientras falte alguno (métricas llegan en sprints 2-5).' })
  indiceAsequibilidad!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Longitud del centroide (WGS84).' })
  lng!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Latitud del centroide (WGS84).' })
  lat!: number | null;

  @ApiProperty({ format: 'date-time' })
  actualizadoEn!: string;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}
