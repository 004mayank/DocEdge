import { Module } from '@nestjs/common';
import { ConsultationsModule } from '../consultations/consultations.module';
import { PatientArtifactsService } from './patient.artifacts.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [ConsultationsModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientArtifactsService],
})
export class PatientsModule {}
