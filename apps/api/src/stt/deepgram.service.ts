import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';
import { request } from 'undici';

@Injectable()
export class DeepgramService {
  private env = loadEnv();

  async transcribe(params: {
    audioBuffer: Buffer;
    mimetype: string;
    language?: string;
  }) {
    if (!this.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not set');

    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('diarize', 'false');
    if (params.language) url.searchParams.set('language', params.language);

    const res = await request(url.toString(), {
      method: 'POST',
      headers: {
        authorization: `Token ${this.env.DEEPGRAM_API_KEY}`,
        'content-type': params.mimetype,
      },
      body: params.audioBuffer,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const txt = await res.body.text();
      throw new Error(`Deepgram error ${res.statusCode}: ${txt}`);
    }

    const json: any = await res.body.json();

    const alt = json?.results?.channels?.[0]?.alternatives?.[0];
    const transcriptText: string = alt?.transcript ?? '';
    const words = alt?.words ?? [];

    // Map Deepgram words to our segment format (simple single-speaker for MVP)
    const segments = words.length
      ? [
          {
            t0: words[0].start,
            t1: words[words.length - 1].end,
            speaker: 'unknown',
            text: transcriptText,
            words: words.map((w: any) => ({
              t0: w.start,
              t1: w.end,
              word: w.word,
            })),
          },
        ]
      : [];

    return {
      language: params.language ?? 'en',
      text: transcriptText,
      segments,
      raw: json,
    };
  }
}
