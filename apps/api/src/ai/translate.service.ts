import { Injectable } from '@nestjs/common';
import { openaiChatJson } from './openai.client';

@Injectable()
export class TranslateService {
  async translateDiarizedTranscriptToEnglish(input: {
    language: string;
    segments: { speaker: string; text: string; t0?: number; t1?: number }[];
  }) {
    const schemaHint = `{
  "language": "en",
  "segments": [{"speaker":"doctor|patient|unknown","t0":0,"t1":0,"text":"string"}],
  "text": "string"
}`;

    const system = [
      'You translate clinical conversation into English.',
      'Preserve speaker labels (doctor/patient/unknown) and timestamps if provided.',
      'Return JSON only.',
    ].join('\n');

    const user = JSON.stringify(input);

    return openaiChatJson<any>({ system, user, schemaHint });
  }
}
