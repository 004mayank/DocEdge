import { Module } from '@nestjs/common';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';
import { JobsModule } from '../jobs/jobs.module';
import { ConsultationsReadController } from './consultations.read.controller';
import { ConsultationsReadService } from './consultations.read.service';

@Module({
  imports: [JobsModule],
  controllers: [ConsultationsController, ConsultationsReadController],
  providers: [ConsultationsService, ConsultationsReadService],
})
export class ConsultationsModule {}
