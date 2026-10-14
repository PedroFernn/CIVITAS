import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ColoniasController } from './colonias/colonias.controller';
import { ColoniasService } from './colonias/colonias.service';
import { TilesController } from './tiles/tiles.controller';
import { DatosAbiertosController } from './datos-abiertos/datos-abiertos.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, ColoniasController, TilesController, DatosAbiertosController],
  providers: [ColoniasService],
})
export class AppModule {}
