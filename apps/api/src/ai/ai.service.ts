import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';

@Injectable()
export class AiService {
  private env = loadEnv();

  flattenTranscript(transcript: any): string {
    const segs = transcript?.segments ?? [];
    return segs.map((s: any) => s.text).join('\n');
  }

  async generateSoapNote(input: { transcriptText: string; language: string }) {
    // MVP: placeholder. Next step: wire to OpenAI + later internal provider.
    void input;
    const soap = {
      subjective: 'Pending STT/LLM',
      objective: '',
      assessment: 'Assistive insights only. Not a diagnosis.',
      plan: '',
    };

    const insights = {
      entities: [],
      actions: [],
      warnings: ['Assistive output only. Doctor must verify.'],
      provider: this.env.AI_PROVIDER,
    };

    return { soap, insights };
  }
}
