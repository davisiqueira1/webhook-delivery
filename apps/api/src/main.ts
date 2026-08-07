import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Env } from './config/env.schema';
import { ENV } from './config/env.provider';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);
  await app.listen(env.PORT);
}
bootstrap();
