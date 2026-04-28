import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtGuard } from '../auth/jwt.guard';
import { UploadsService } from './uploads.service';

const PresignSchema = z.object({
  kind: z.enum(['audio', 'document', 'image']),
  patientId: z.string().uuid().optional(),
  consultationId: z.string().uuid().optional(),
  contentType: z.string().min(1),
  originalName: z.string().min(1).optional(),
});

@Controller('uploads')
@UseGuards(JwtGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  async presign(@Body() body: unknown, @Req() req: any) {
    const dto = PresignSchema.parse(body);
    return this.uploads.presignPut(req.user, dto);
  }
}
