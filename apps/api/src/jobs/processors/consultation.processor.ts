import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DB } from '../../db/db.module';
import { consultations, timelineEvents } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import { AiService } from '../../ai/ai.service';

@Processor('consultation')
export class ConsultationProcessor extends WorkerHost {
  constructor(
    @Inject(DB) private readonly dbConn: { db: any; pool: any },
    private readonly ai: AiService,
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

    // Placeholder transcript + note generation until STT is wired
    const transcript = c.transcript ?? {
      language: 'en',
      segments: [],
      note: 'STT not wired yet; transcript empty',
    };

    const note = await this.ai.generateSoapNote({
      transcriptText: this.ai.flattenTranscript(transcript),
      language: transcript.language ?? 'en',
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
