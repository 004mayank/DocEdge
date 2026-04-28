import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtGuard } from '../auth/jwt.guard';
import { ConsultationsReadService } from '../consultations/consultations.read.service';
import { PatientArtifactsService } from './patient.artifacts.service';
import { PatientsService } from './patients.service';

const CreatePatientSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
});

@Controller('patients')
@UseGuards(JwtGuard)
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly consultationsRead: ConsultationsReadService,
    private readonly artifacts: PatientArtifactsService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @Req() req: any) {
    const dto = CreatePatientSchema.parse(body);
    return this.patients.create(req.user, dto);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    return this.patients.get(req.user, id);
  }

  @Get(':id/timeline')
  async timeline(@Param('id') id: string, @Req() req: any) {
    return this.patients.timeline(req.user, id);
  }

  @Get(':id/consultations')
  async consultations(@Param('id') id: string, @Req() req: any) {
    return this.consultationsRead.listByPatient(req.user, id);
  }

  @Get(':id/artifacts')
  async listArtifacts(@Param('id') id: string, @Req() req: any) {
    const kind = (req.query?.kind as string | undefined) ?? undefined;
    return this.artifacts.list(req.user, id, kind);
  }
}
