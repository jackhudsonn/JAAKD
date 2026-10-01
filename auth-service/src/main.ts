import 'reflect-metadata';

import { existsSync } from 'fs';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtIssuer = process.env.JWT_ISSUER?.trim();
  const jwtPrivateKeyPath = process.env.JWT_PRIVATE_KEY_PATH?.trim();
  const jwtPrivateKey = process.env.JWT_PRIVATE_KEY?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!jwtIssuer) {
    throw new Error('JWT_ISSUER is required');
  }

  if (!jwtPrivateKeyPath && !jwtPrivateKey) {
    throw new Error('JWT_PRIVATE_KEY_PATH or JWT_PRIVATE_KEY is required');
  }

  if (jwtPrivateKeyPath && !existsSync(jwtPrivateKeyPath)) {
    throw new Error(`JWT private key file does not exist: ${jwtPrivateKeyPath}`);
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
