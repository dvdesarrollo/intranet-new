import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Intranet Multi-tenant API')
    .setDescription(
      'API REST para gestión de empleados, nómina, asistencia, solicitudes, ' +
        'comunicación interna y documentos. Todas las rutas (excepto auth y ' +
        'el panel de plataforma) requieren resolver el tenant vía subdominio ' +
        'o header `X-Tenant-Slug`.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('tenants')
    .addTag('employees')
    .addTag('payroll')
    .addTag('attendance')
    .addTag('requests')
    .addTag('notifications')
    .addTag('communication')
    .addTag('documents')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
