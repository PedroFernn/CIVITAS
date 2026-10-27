import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ColoniasController } from './colonias/colonias.controller';
import { ColoniasService } from './colonias/colonias.service';
import { TilesController } from './tiles/tiles.controller';
import { DatosAbiertosController } from './datos-abiertos/datos-abiertos.controller';
import { AdminController, AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SesionGuard } from './auth/sesion.guard';
import { RentaController } from './renta/renta.controller';
import { RentaService } from './renta/renta.service';
import { ZonasController } from './zonas/zonas.controller';
import { ZonasService } from './zonas/zonas.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, ColoniasController, TilesController, DatosAbiertosController, RentaController, ZonasController, AuthController, AdminController],
  providers: [ColoniasService, RentaService, ZonasService, AuthService, SesionGuard],
})
export class AppModule {}
