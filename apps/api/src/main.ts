import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { ZodExceptionFilter } from './shared/zod-exception.filter';

async function bootstrap() {
  const env = loadEnv();

  // Apply SQL migrations on startup in containerized/dev flows.
  // (Safe + idempotent because we track applied migrations.)
  await runMigrations();

  const app = await NestFactory.create(AppModule);
  // Allow the browser-based web app to call the API directly in dev.
  // (Docker setup also supports same-origin proxying via the web app.)
  app.enableCors({
    origin: true,
    credentials: true,
  });
  // Ensure Zod validation errors become a clean 400 response (not a 500).
  app.useGlobalFilters(new ZodExceptionFilter());
  await app.listen(env.PORT);
}
bootstrap();
