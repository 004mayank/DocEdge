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
import { inferQnaFromUtterances } from '../../consultations/inference';

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
      if (!c.audioObjectKey) {
        throw new Error('Missing audioObjectKey for consultation');
      }

      const audio = await this.s3get.getObjectBuffer(c.audioObjectKey);
      const inputLang = (c.inputLanguage as string) || 'en';

      const sttLang = inputLang === 'hi-en' ? undefined : inputLang;

      const transcriptResult = await this.deepgram.transcribe({
        audioBuffer: audio.buffer,
        mimetype: audio.contentType ?? 'application/octet-stream',
        language: sttLang,
      });

      const transcriptOriginal = {
        language: inputLang,
        segments: transcriptResult.segments,
        text: transcriptResult.text,
      };

      let transcriptEn = transcriptOriginal;
      if (inputLang !== 'en') {
        transcriptEn = await this.translate.translateDiarizedTranscriptToEnglish({
          language: inputLang,
          segments: (transcriptOriginal.segments ?? []).map((s: any) => ({
            speaker: s.speaker,
            text: s.text,
            t0: s.t0,
            t1: s.t1,
          })),
        });
      }

      const note = await this.ai.generateSoapNote({
        transcriptText:
          transcriptEn.text ?? this.ai.flattenTranscript(transcriptEn),
        language: 'en',
      });

      // If diarization is unreliable (single speaker), infer Q/A as a fallback.
      let inferredQna: any = null;
      try {
        const segs = (transcriptOriginal as any)?.segments ?? [];
        const speakerSet = new Set<string>();
        for (const s of segs) {
          if (s?.speaker) speakerSet.add(String(s.speaker));
        }
        if (speakerSet.size <= 1) {
          const rawUtterances = (transcriptResult as any)?.raw?.utterances;
          inferredQna = inferQnaFromUtterances({
            utterances: Array.isArray(rawUtterances)
              ? rawUtterances.map((u: any) => ({
                  transcript: u.transcript,
                  speaker: u.speaker,
                  start: u.start,
                  end: u.end,
                }))
              : undefined,
            fallbackText: transcriptEn.text,
          });
        }
      } catch {
        inferredQna = null;
      }

      await this.dbConn.db
        .update(consultations)
        .set({
          status: 'completed',
          transcript: transcriptOriginal,
          normalizedTranscriptEn: transcriptEn,
          soapNote: note.soap,
          aiInsights: inferredQna
            ? {
                ...(note.insights ?? {}),
                inferredQna,
              }
            : note.insights,
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
        .set({
          status: 'failed',
          error,
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
        type: 'consultation_failed',
        refId: c.id,
        payload: { consultationId: c.id, error: error.message },
      });

      throw err;
    }
  }
}
