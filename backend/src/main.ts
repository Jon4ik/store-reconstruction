import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Trust the single reverse proxy (frontend Nginx) so request.ip resolves to the client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.DOMAIN || 'http://localhost',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  const config = new DocumentBuilder()
    .setTitle('Реконструкция — Закрытие API')
    .setDescription('API для системы управления реконструкциями и закрытиями магазинов')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on port ${port}`);
}
bootstrap();
