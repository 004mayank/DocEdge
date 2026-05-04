import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SttModule } from '../stt/stt.module';

@Module({
  imports: [SttModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}

