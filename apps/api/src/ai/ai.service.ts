import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { openaiChatJson } from './openai.client';

@Injectable()
export class AiService {
  private env = loadEnv();

  flattenTranscript(transcript: any): string {
    const segs = transcript?.segments ?? [];
    return segs.map((s: any) => s.text).join('\n');
  }

  async generateSoapNote(input: { transcriptText: string; language: string }) {
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
    "subjective": "string",
    "objective": "string",
    "assessment": "string",
    "plan": "string"
  },
  "insights": {
    "entities": [{"type":"string","value":"string"}],
    "actions": [{"title":"string","why":"string"}],
    "warnings": ["string"]
  }
}`;

    const system = [
      'You are DocEdge clinical intelligence engine.',
      'Generate ASSISTIVE clinical documentation from transcript.',
      'Do NOT provide definitive diagnosis. Use cautious language.',
      'Output must be JSON only.',
    ].join('\n');

    const user = [
      `Language: ${input.language}`,
      'Transcript follows:',
      input.transcriptText || '(empty transcript)',
    ].join('\n\n');

    const out = await openaiChatJson<any>({ system, user, schemaHint });

    // Ensure warnings always include the safety line
    out.insights = out.insights ?? {};
    out.insights.warnings = Array.isArray(out.insights.warnings)
      ? out.insights.warnings
      : [];
    if (
      !out.insights.warnings.some((w: string) =>
        w.toLowerCase().includes('assistive'),
      )
    ) {
      out.insights.warnings.unshift(
        'Assistive output only. Doctor must verify.',
      );
    }

    return out;
  }
}
