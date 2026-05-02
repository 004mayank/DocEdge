import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { JobsModule } from './jobs/jobs.module';

/**
 * Worker-only module.
 *
 * Keeps the worker lean by avoiding HTTP controllers + web-only modules.
 * BullMQ processors are registered under JobsModule.
 */
@Module({
  imports: [DbModule, JobsModule],
})
export class WorkerModule {}
