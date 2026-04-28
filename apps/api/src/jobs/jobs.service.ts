import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('consultation') private readonly consultationQueue: Queue,
  ) {}

  async enqueueConsultationProcess(payload: { consultationId: string }) {
    return this.consultationQueue.add('process', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
