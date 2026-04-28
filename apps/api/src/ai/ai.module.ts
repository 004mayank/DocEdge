import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { TranslateService } from './translate.service';

@Module({
  providers: [AiService, TranslateService],
  exports: [AiService, TranslateService],
})
export class AiModule {}
