import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('salud')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async health() {
    try {
      const [r] = await this.db.query<{ postgis: string }>('SELECT postgis_version() AS postgis');
      return { status: 'ok', postgis: r?.postgis };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', detalle: 'base de datos no disponible' });
    }
  }
}
