import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DB } from '../../db/db.module';
import { artifacts, consultations, timelineEvents } from '../../db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { AiService } from '../../ai/ai.service';
import { TranslateService } from '../../ai/translate.service';
import { S3GetService } from '../../uploads/s3.get.service';
import { DeepgramService } from '../../stt/deepgram.service';
import pdfParse from 'pdf-parse';

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
      } else if (c.audioObjectKey) {
        // Fallback: batch-transcribe the uploaded audio
        try {
          const audio = await this.s3get.getObjectBuffer(c.audioObjectKey);
          const sttLang = inputLang === 'hi-en' ? undefined : inputLang;
          const transcriptResult = await this.deepgram.transcribe({
            audioBuffer: audio.buffer,
            mimetype: audio.contentType ?? 'application/octet-stream',
            language: sttLang,
          });
          rawSegments = transcriptResult.segments ?? [];
        } catch (sttErr: any) {
          // Batch STT failed — proceed with empty transcript so SOAP still generates
          rawSegments = [];
        }
      } else {
        // No transcript and no audio — generate SOAP from empty transcript
        rawSegments = [];
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

      // ── Step 5: Analyze image and document artifacts attached to this consultation ──
      let imagingContext: string | undefined;
      let imagingResult: Awaited<ReturnType<typeof this.ai.analyzeImagingStudy>> | undefined;
      let documentContextParts: string[] = [];
      let documentResults: Awaited<ReturnType<typeof this.ai.analyzeDocumentReport>>[] = [];

      try {
        const attachedArtifacts = await this.dbConn.db
          .select()
          .from(artifacts)
          .where(
            and(
              eq(artifacts.consultationId, consultationId),
              inArray(artifacts.kind, ['image', 'document']),
            ),
          );

        const imageArts = attachedArtifacts.filter((a: any) => a.kind === 'image');
        const docArts = attachedArtifacts.filter((a: any) => a.kind === 'document');

        // Images → GPT-4o vision
        if (imageArts.length > 0) {
          const imageInputs: Array<{ base64: string; mimeType: string }> = [];
          for (const art of imageArts) {
            try {
              const { buffer, contentType } = await this.s3get.getObjectBuffer(art.objectKey);
              const mimeType = contentType ?? art.contentType ?? 'image/jpeg';
              if (!mimeType.startsWith('image/')) continue;
              if (imageInputs.length >= 4) break;
              imageInputs.push({ base64: buffer.toString('base64'), mimeType });
            } catch { /* skip */ }
          }
          if (imageInputs.length > 0) {
            imagingResult = await this.ai.analyzeImagingStudy(imageInputs);
            imagingContext = [
              `Modality: ${imagingResult.modality}`,
              `Findings: ${imagingResult.findings.join('; ') || 'None noted'}`,
              `Impression: ${imagingResult.impressions}`,
              ...(imagingResult.flags.length ? [`Flags: ${imagingResult.flags.join('; ')}`] : []),
            ].join('\n');
          }
        }

        // Documents (PDF) → extract text → GPT analysis
        for (const art of docArts.slice(0, 3)) {
          try {
            const { buffer, contentType } = await this.s3get.getObjectBuffer(art.objectKey);
            const mime = contentType ?? art.contentType ?? '';
            let text = '';
            if (mime.includes('pdf') || art.originalName?.endsWith('.pdf')) {
              const parsed = await pdfParse(buffer);
              text = parsed.text?.trim() ?? '';
            } else {
              // Plain text / other text documents
              text = buffer.toString('utf-8').trim();
            }
            if (!text) continue;
            const result = await this.ai.analyzeDocumentReport(text);
            documentResults.push(result);
            documentContextParts.push(
              [
                `Report: ${result.reportType}`,
                `Findings: ${result.keyFindings.join('; ') || 'None noted'}`,
                `Summary: ${result.summary}`,
                ...(result.flags.length ? [`Flags: ${result.flags.join('; ')}`] : []),
              ].join('\n'),
            );
          } catch { /* skip individual failures */ }
        }
      } catch { /* artifact analysis is best-effort */ }

      // ── Step 6: Generate SOAP note ─────────────────────────────────
      const documentContext = documentContextParts.length
        ? documentContextParts.join('\n\n---\n\n')
        : undefined;

      const note = await this.ai.generateSoapNote({
        transcriptText,
        language: 'en',
        imagingContext,
        documentContext,
      });

      // Merge imaging findings into insights
      if (imagingResult) {
        note.insights = note.insights ?? {};
        note.insights.imaging = {
          modality: imagingResult.modality,
          findings: imagingResult.findings,
          impression: imagingResult.impressions,
        };
        if (imagingResult.flags.length) {
          note.insights.warnings = [
            ...imagingResult.flags.map((f) => `[Imaging] ${f}`),
            ...(note.insights.warnings ?? []),
          ];
        }
      }

      // Merge document report findings into insights
      if (documentResults.length > 0) {
        note.insights = note.insights ?? {};
        note.insights.documents = documentResults.map((r) => ({
          reportType: r.reportType,
          keyFindings: r.keyFindings,
          summary: r.summary,
        }));
        const docFlags = documentResults.flatMap((r) => r.flags);
        if (docFlags.length) {
          note.insights.warnings = [
            ...docFlags.map((f) => `[Report] ${f}`),
            ...(note.insights.warnings ?? []),
          ];
        }
      }

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
