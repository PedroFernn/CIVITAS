import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

/** Configuración común de la app (la usan main.ts y las pruebas e2e). */
export function configureApp(app: INestApplication, opts: { swagger?: boolean } = {}) {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','), methods: ['GET'] });
  if (opts.swagger) {
    const doc = new DocumentBuilder()
      .setTitle('CIVITAS API')
      .setDescription('Observatorio urbano · MVP-2: datos abiertos y zonas piloto (solo lectura)')
      .setVersion('0.2.0')
      // Prefijo público con el que Caddy expone la API (p. ej. /api): hace que "Try it out" funcione detrás del proxy.
      .addServer(process.env.API_BASE_PATH ?? '/')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }
  return app;
}
