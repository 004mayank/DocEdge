import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsReadController } from './uploads.read.controller';
import { UploadsReadService } from './uploads.read.service';
import { UploadsService } from './uploads.service';
import { S3Service } from './s3.service';
import { S3GetService } from './s3.get.service';
import { S3PresignGetService } from './s3.presignget.service';

@Module({
  controllers: [UploadsController, UploadsReadController],
  providers: [
    UploadsService,
    UploadsReadService,
    S3Service,
    S3GetService,
    S3PresignGetService,
  ],
  exports: [UploadsService, S3GetService, S3PresignGetService],
})
export class UploadsModule {}
