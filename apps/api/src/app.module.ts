import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { UploadsModule } from './uploads/uploads.module';
import { AiModule } from './ai/ai.module';
import { JobsModule } from './jobs/jobs.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    PatientsModule,
    ConsultationsModule,
    UploadsModule,
    AiModule,
    JobsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
