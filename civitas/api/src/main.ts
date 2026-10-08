import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableShutdownHooks();

  // OpenAPI: UI en /docs y contrato en /docs-json (tras Caddy: /api/docs y /api/docs-json).
  // API_BASE_PATH = prefijo público con el que Caddy expone la API (p. ej. /api) para que "Try it out" funcione.
  const config = new DocumentBuilder()
    .setTitle('CIVITAS API')
    .setDescription('API pública de solo lectura del MVP-1. Sin autenticación ni datos personales.')
    .setVersion('0.1.0')
    .addServer(process.env.API_BASE_PATH ?? '/')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}
bootstrap();
