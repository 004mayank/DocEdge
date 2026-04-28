import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtGuard } from '../auth/jwt.guard';
import { ConsultationsReadService } from './consultations.read.service';

const UpdateSoapSchema = z.object({
  soapNote: z.object({
    subjective: z.string().optional().default(''),
    objective: z.string().optional().default(''),
    assessment: z.string().optional().default(''),
    plan: z.string().optional().default(''),
  }),
});

@Controller('consultations')
@UseGuards(JwtGuard)
export class ConsultationsReadController {
  constructor(private readonly read: ConsultationsReadService) {}

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    return this.read.get(req.user, id);
  }

  @Get(':id/status')
  async status(@Param('id') id: string, @Req() req: any) {
    return this.read.status(req.user, id);
  }

  @Patch(':id/soap')
  async updateSoap(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const dto = UpdateSoapSchema.parse(body);
    return this.read.updateSoap(req.user, id, dto.soapNote);
  }
}
