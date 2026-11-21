import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvConfig } from '@Config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<EnvConfig, true>);

  configureApp(app);

  // CORS solo para el frontend: FRONTEND_URL admite varios orígenes separados por comas.
  const frontendUrl = configService.get('FRONTEND_URL', { infer: true });
  const origenes = frontendUrl
    ? frontendUrl.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
    : configService.get('NODE_ENV', { infer: true }) === 'production'
      ? []
      : ['http://localhost:3001'];
  app.enableCors({ origin: origenes, credentials: true });

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gestión de Condominios API')
    .setDescription('API REST para la gestión de condominios: cuotas y pagos, reservas, visitas, paquetería, reportes, comunicados y asambleas.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}

await bootstrap();
