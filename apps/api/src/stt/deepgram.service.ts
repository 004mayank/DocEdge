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
    url.searchParams.set('diarize', 'true');
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
    const words: any[] = alt?.words ?? [];

    // Build diarized segments by speaker id, MVP mapping:
    // speaker 0 => doctor, speaker 1 => patient
    const labelSpeaker = (sid: any) => {
      if (sid === 0) return 'doctor';
      if (sid === 1) return 'patient';
      return 'unknown';
    };

    const segments: any[] = [];
    let cur: any | null = null;

    for (const w of words) {
      const speaker = labelSpeaker(w.speaker);
      if (!cur || cur.speaker !== speaker) {
        if (cur) segments.push(cur);
        cur = {
          t0: w.start,
          t1: w.end,
          speaker,
          text: w.word,
          words: [{ t0: w.start, t1: w.end, word: w.word }],
        };
      } else {
        cur.t1 = w.end;
        cur.text = `${cur.text} ${w.word}`;
        cur.words.push({ t0: w.start, t1: w.end, word: w.word });
      }
    }
    if (cur) segments.push(cur);

    return {
      language: params.language ?? 'en',
      text: transcriptText,
      segments,
      raw: json,
    };
  }
}
