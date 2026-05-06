import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DB } from '../../db/db.module';
import { consultations, timelineEvents } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import { AiService } from '../../ai/ai.service';
import { TranslateService } from '../../ai/translate.service';
import { S3GetService } from '../../uploads/s3.get.service';
import { DeepgramService } from '../../stt/deepgram.service';

@Processor('consultation')
export class ConsultationProcessor extends WorkerHost {
  constructor(
    @Inject(DB) private readonly dbConn: { db: any; pool: any },
    private readonly ai: AiService,
    private readonly translate: TranslateService,
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

    try {
      const inputLang = (c.inputLanguage as string) || 'en';

      // ── Step 1: Get transcript ──────────────────────────────────────
      // Use the realtime transcript saved at stop-time if segments are available.
      // Fall back to Deepgram batch transcription only if there is no realtime transcript.
      const storedSegments: any[] = (c.transcript as any)?.segments ?? [];
      const hasRealtimeTranscript = storedSegments.length > 0;

      let rawSegments: Array<{ speaker: number | string; text: string }>;

      if (hasRealtimeTranscript) {
        rawSegments = storedSegments;
      } else {
        if (!c.audioObjectKey) {
          throw new Error('No realtime transcript and no audio file to transcribe');
        }

        const audio = await this.s3get.getObjectBuffer(c.audioObjectKey);
        const sttLang = inputLang === 'hi-en' ? undefined : inputLang;

        const transcriptResult = await this.deepgram.transcribe({
          audioBuffer: audio.buffer,
          mimetype: audio.contentType ?? 'application/octet-stream',
          language: sttLang,
        });

        rawSegments = transcriptResult.segments ?? [];
      }

      // ── Step 2: AI-based speaker re-attribution ────────────────────
      // Deepgram assigns speaker 0/1 by arrival order. GPT re-labels
      // each segment as 'doctor' or 'patient' based on clinical context.
      const numericSegs = rawSegments.map((s) => ({
        speaker: typeof s.speaker === 'number' ? s.speaker : (s.speaker === 'patient' ? 1 : 0),
        text: s.text,
      }));

      const labelledSegments = await this.ai.relabelSpeakers(numericSegs);

      // ── Step 3: Translate if needed ────────────────────────────────
      let finalSegments = labelledSegments;
      if (inputLang !== 'en') {
        const translated = await this.translate.translateDiarizedTranscriptToEnglish({
          language: inputLang,
          segments: labelledSegments.map((s) => ({
            speaker: s.speaker,
            text: s.text,
          })),
        });
        finalSegments = (translated.segments ?? []).map((s: any) => ({
          speaker: s.speaker as 'doctor' | 'patient',
          text: s.text,
        }));
      }

      // ── Step 4: Build labelled transcript text for SOAP ────────────
      const transcriptText = finalSegments
        .map((s) => `${s.speaker === 'doctor' ? 'Doctor' : 'Patient'}: ${s.text}`)
        .join('\n');

      const transcriptToSave = {
        language: inputLang,
        segments: finalSegments,
        text: transcriptText,
      };

      // ── Step 5: Generate SOAP note ─────────────────────────────────
      const note = await this.ai.generateSoapNote({
        transcriptText,
        language: 'en',
      });

      await this.dbConn.db
        .update(consultations)
        .set({
          status: 'completed',
          transcript: transcriptToSave,
          normalizedTranscriptEn: transcriptToSave,
          soapNote: note.soap,
          aiInsights: note.insights,
          error: null,
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
    } catch (err: any) {
      const error = {
        message: err?.message ?? String(err),
        name: err?.name,
        stack: err?.stack,
      };

      await this.dbConn.db
        .update(consultations)
        .set({ status: 'failed', error })
        .where(
          and(
            eq(consultations.id, consultationId),
            eq(consultations.clinicId, c.clinicId),
          ),
        );

      await this.dbConn.db.insert(timelineEvents).values({
        clinicId: c.clinicId,
        patientId: c.patientId,
        type: 'consultation_failed',
        refId: c.id,
        payload: { consultationId: c.id, error: error.message },
      });

      throw err;
    }
  }
}
