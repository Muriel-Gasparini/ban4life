import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  await app.listen(env.PORT);
  logger.log(`🛡️ Ban4Life API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Ban4Life API:', err);
  process.exit(1);
});
