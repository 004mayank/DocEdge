import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

/**
 * Background worker entrypoint.
 *
 * BullMQ processors are registered via @Processor() decorators.
 * Bootstrapping the Nest app context is enough to start consuming jobs.
 */
async function bootstrap() {
  const logger = new Logger('worker');

  // createApplicationContext() avoids starting an HTTP server.
  await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  logger.log('Worker started');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start', err);
  process.exit(1);
});
