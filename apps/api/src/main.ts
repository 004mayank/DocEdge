import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  const env = loadEnv();

  // Apply SQL migrations on startup in containerized/dev flows.
  // (Safe + idempotent because we track applied migrations.)
  await runMigrations();

  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
}
bootstrap();
