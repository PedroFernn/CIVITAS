import { Module } from '@nestjs/common';
import { Db } from './db';
import { HealthController } from './health.controller';
import { ZonasController } from './zonas.controller';

@Module({ controllers: [ZonasController, HealthController], providers: [Db] })
export class AppModule {}
