import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { UploadsReadService } from './uploads.read.service';

@Controller('uploads')
@UseGuards(JwtGuard)
export class UploadsReadController {
  constructor(private readonly read: UploadsReadService) {}

  @Get('artifacts/:id/presign-get')
  async presignGet(@Param('id') id: string, @Req() req: any) {
    return this.read.presignArtifactGet(req.user, id);
  }
}
