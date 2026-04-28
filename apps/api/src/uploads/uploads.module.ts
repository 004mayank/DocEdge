import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { S3Service } from './s3.service';
import { S3GetService } from './s3.get.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, S3Service, S3GetService],
  exports: [UploadsService, S3GetService],
})
export class UploadsModule {}
