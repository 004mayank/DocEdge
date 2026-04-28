import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  const env = loadEnv();

  // Dev convenience: auto-apply SQL migrations on startup.
  // In production, run `pnpm db:migrate` in your deploy pipeline instead.
  if (env.NODE_ENV === 'development') {
    await runMigrations();
  }

  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
}
bootstrap();
