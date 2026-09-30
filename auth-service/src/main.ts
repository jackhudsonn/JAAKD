import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
  }

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:4200',
  });

  app.getHttpAdapter().getInstance().disable('x-powered-by');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('JAAKD Auth Service')
    .setDescription('Authentication endpoints for JAAKD')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
