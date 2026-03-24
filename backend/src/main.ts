import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for desktop app
  app.enableCors({
    origin: ['http://104.207.142.188:5173', 'http://104.207.142.188:3000'],
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 PayJA Backend rodando em http://104.207.142.188:${port}`);
  console.log(`📡 API disponível em http://104.207.142.188:${port}/api/v1`);
}

bootstrap();
