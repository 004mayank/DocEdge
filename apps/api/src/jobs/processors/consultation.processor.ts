import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DB } from '../../db/db.module';
import { consultations, timelineEvents } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import { AiService } from '../../ai/ai.service';
import { S3GetService } from '../../uploads/s3.get.service';
import { DeepgramService } from '../../stt/deepgram.service';

@Processor('consultation')
export class ConsultationProcessor extends WorkerHost {
  constructor(
    @Inject(DB) private readonly dbConn: { db: any; pool: any },
    private readonly ai: AiService,
    private readonly s3get: S3GetService,
    private readonly deepgram: DeepgramService,
  ) {
    super();
  }

  async process(job: Job<{ consultationId: string }>) {
    const { consultationId } = job.data;

    const rows = await this.dbConn.db
      .select()
      .from(consultations)
      .where(eq(consultations.id, consultationId));

    const c = rows[0];
    if (!c) return;

    if (!c.audioObjectKey) {
      throw new Error('Missing audioObjectKey for consultation');
    }

    const audio = await this.s3get.getObjectBuffer(c.audioObjectKey);
    const transcriptResult = await this.deepgram.transcribe({
      audioBuffer: audio.buffer,
      mimetype: audio.contentType ?? 'application/octet-stream',
      language: (c.transcript as any)?.language ?? 'en',
    });

    const transcript = {
      language: transcriptResult.language,
      segments: transcriptResult.segments,
      text: transcriptResult.text,
    };

    const note = await this.ai.generateSoapNote({
      transcriptText: transcriptResult.text,
      language: transcriptResult.language ?? 'en',
    });

    await this.dbConn.db
      .update(consultations)
      .set({
        status: 'completed',
        transcript,
        soapNote: note.soap,
        aiInsights: note.insights,
      })
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.clinicId, c.clinicId),
        ),
      );

    await this.dbConn.db.insert(timelineEvents).values({
      clinicId: c.clinicId,
      patientId: c.patientId,
      type: 'consultation_completed',
      refId: c.id,
      payload: { consultationId: c.id },
    });
  }
}
