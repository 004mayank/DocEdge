import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtGuard } from '../auth/jwt.guard';
import { ConsultationsService } from './consultations.service';

const StartSchema = z.object({
  patientId: z.string().uuid(),
  inputLanguage: z.enum(['en', 'hi', 'hi-en']).optional(),
});

const StopSchema = z.object({
  audioObjectKey: z.string().min(1),
  language: z.string().optional(),
});

@Controller('consultations')
@UseGuards(JwtGuard)
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Post('start')
  async start(@Body() body: unknown, @Req() req: any) {
    const dto = StartSchema.parse(body);
    return this.consultations.start(req.user, dto);
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const dto = StopSchema.parse(body);
    return this.consultations.stop(req.user, id, dto);
  }
}
