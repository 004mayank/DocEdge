import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { loadEnv } from '../config/env';
import { JobsService } from './jobs.service';
import { ConsultationProcessor } from './processors/consultation.processor';
import { AiModule } from '../ai/ai.module';
import { UploadsModule } from '../uploads/uploads.module';
import { SttModule } from '../stt/stt.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: loadEnv().REDIS_URL },
    }),
    BullModule.registerQueue({
      name: 'consultation',
    }),
    AiModule,
    UploadsModule,
    SttModule,
  ],
  providers: [JobsService, ConsultationProcessor],
  exports: [JobsService],
})
export class JobsModule {}
