import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { openaiChatJson, openaiVisionJson } from './openai.client';

export type TranscriptSegment = { speaker: string | number; text: string };

@Injectable()
export class AiService {
  private env = loadEnv();

  flattenTranscript(transcript: any): string {
    const segs: TranscriptSegment[] = transcript?.segments ?? [];
    return segs
      .map((s) => `${s.speaker === 'doctor' || s.speaker === 0 ? 'Doctor' : 'Patient'}: ${s.text}`)
      .join('\n');
  }

  /**
   * Re-attribute transcript segments to Doctor / Patient using GPT.
   * Deepgram assigns speaker 0/1 by arrival order, not role.
   * GPT uses clinical context: questions/advice = Doctor, symptoms/answers = Patient.
   */
  async relabelSpeakers(
    segments: Array<{ speaker: number; text: string }>,
  ): Promise<Array<{ speaker: 'doctor' | 'patient'; text: string }>> {
    if (!segments.length) return [];

    const numbered = segments
      .map((s, i) => `${i + 1}. [Speaker ${s.speaker}] ${s.text}`)
      .join('\n');

    const system = [
      'You are a clinical transcript analyst.',
      'Given numbered transcript segments from a doctor-patient consultation, label each as "doctor" or "patient".',
      'Rules:',
      '- Doctor: asks clinical questions, gives advice/diagnosis, mentions medications, refers to medical history',
      '- Patient: describes symptoms, answers questions, expresses concerns or pain',
      '- When uncertain, use conversational flow (question → doctor, answer → patient)',
      'Return JSON only.',
    ].join('\n');

    const schemaHint = `{"labels": ["doctor","patient","doctor",...]}`;

    const user = `Label each segment:\n\n${numbered}`;

    try {
      const out = await openaiChatJson<{ labels: string[] }>({ system, user, schemaHint });
      const labels = out.labels ?? [];
      return segments.map((s, i) => ({
        speaker: (labels[i] === 'patient' ? 'patient' : 'doctor') as 'doctor' | 'patient',
        text: s.text,
      }));
    } catch {
      // Fall back to Deepgram order (speaker 0 = doctor)
      return segments.map((s) => ({
        speaker: (s.speaker === 0 ? 'doctor' : 'patient') as 'doctor' | 'patient',
        text: s.text,
      }));
    }
  }

  async analyzeImagingStudy(images: Array<{ base64: string; mimeType: string }>): Promise<{
    modality: string;
    findings: string[];
    impressions: string;
    flags: string[];
  }> {
    const system = [
      'You are a clinical radiology assistant.',
      'Analyze the provided medical imaging (CT, MRI, X-ray, etc.).',
      'Describe only what is visibly present. Do NOT invent findings.',
      'This is assistive output only — a radiologist or doctor must verify.',
      'Output JSON only.',
    ].join('\n');

    const schemaHint = `{
  "modality": "CT|MRI|X-ray|Ultrasound|Other",
  "findings": ["string — specific observable finding"],
  "impressions": "string — overall clinical impression in 1-2 sentences",
  "flags": ["string — anything that may require urgent attention"]
}`;

    try {
      return await openaiVisionJson<any>({
        system,
        userText: 'Analyze this medical imaging study.',
        images,
        schemaHint,
      });
    } catch {
      return { modality: 'Unknown', findings: [], impressions: 'Image analysis unavailable.', flags: [] };
    }
  }

  async generateSoapNote(input: { transcriptText: string; language: string; imagingContext?: string }) {
    if (this.env.AI_PROVIDER === 'internal') {
      return {
        soap: {
          subjective: 'Internal AI provider not wired yet',
          objective: '',
          assessment: 'Assistive insights only. Not a diagnosis.',
          plan: '',
        },
        insights: {
          entities: [],
          actions: [],
          warnings: ['Assistive output only. Doctor must verify.'],
          provider: 'internal',
        },
      };
    }

    const schemaHint = `{
  "soap": {
    "subjective": "string — patient's chief complaint and history in their own words",
    "objective": "string — clinical observations, vitals, exam findings mentioned",
    "assessment": "string — doctor's working diagnosis or clinical impression",
    "plan": "string — treatment, medications, follow-up, referrals"
  },
  "insights": {
    "entities": [{"type":"symptom|medication|diagnosis|vitals","value":"string"}],
    "actions": [{"title":"string","why":"string"}],
    "warnings": ["string"]
  }
}`;

    const system = [
      'You are DocEdge, a clinical documentation assistant.',
      'Generate a structured SOAP note from the doctor-patient consultation transcript.',
      'The transcript is labelled with Doctor: / Patient: prefixes.',
      'Use the patient\'s words for Subjective. Use doctor\'s observations for Objective.',
      'Assessment should reflect the doctor\'s clinical impression from the conversation.',
      'Plan should include any treatments, prescriptions, tests, or follow-up mentioned.',
      'Be specific and clinical. Do NOT invent information not present in the transcript.',
      'Use cautious language — this is assistive, not a definitive record.',
      'Output JSON only.',
    ].join('\n');

    const user = [
      `Language: ${input.language}`,
      'Consultation transcript:',
      input.transcriptText || '(empty transcript)',
      ...(input.imagingContext ? ['\nImaging study findings (attach to Objective):', input.imagingContext] : []),
    ].join('\n\n');

    const out = await openaiChatJson<any>({ system, user, schemaHint });

    out.insights = out.insights ?? {};
    out.insights.warnings = Array.isArray(out.insights.warnings)
      ? out.insights.warnings
      : [];
    if (!out.insights.warnings.some((w: string) => w.toLowerCase().includes('assistive'))) {
      out.insights.warnings.unshift('Assistive output only. Doctor must verify.');
    }

    return out;
  }
}
