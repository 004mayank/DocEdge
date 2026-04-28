import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ConsultationsReadService } from './consultations.read.service';

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
}
