import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Db } from './db';
import { HealthDto } from './zona.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: Db) {}
  @Get()
  @ApiOperation({ summary: 'Estado de la API y de la base de datos', description: 'Ejecuta SELECT 1; si la base no responde falla con 500.' })
  @ApiOkResponse({ type: HealthDto })
  @ApiResponse({ status: 500, description: 'La base de datos no responde.' })
  async check() {
    await this.db.query('SELECT 1');
    return { status: 'ok' };
  }
}
