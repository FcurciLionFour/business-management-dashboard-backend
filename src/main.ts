import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
      origin: [
    'https://demos.lionfouracademy.com',
    'http://localhost:4200',
  ],
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
