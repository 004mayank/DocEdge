import { loadEnv } from '../config/env';

export type DeepgramRealtimeOptions = {
  language?: string;
  mimetype: string;
};

export type DeepgramRealtimeTranscriptEvent = {
  isFinal: boolean;
  transcript: string;
  // diarization per word when available
  words?: Array<{ word: string; speaker?: number; start?: number; end?: number }>;
  raw: any;
};

// Minimal Deepgram realtime WS client using Node's built-in WebSocket.
// Endpoint: wss://api.deepgram.com/v1/listen
export class DeepgramRealtimeClient {
  private env = loadEnv();
  private ws: WebSocket | null = null;
  private onTranscript: ((e: DeepgramRealtimeTranscriptEvent) => void) | null =
    null;

  constructor(private opts: DeepgramRealtimeOptions) {}

  async connect(onTranscript: (e: DeepgramRealtimeTranscriptEvent) => void) {
    if (!this.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not set');

    this.onTranscript = onTranscript;

    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-2');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('diarize', 'true');
    url.searchParams.set('endpointing', '100');
    if (this.opts.language && this.opts.language !== 'hi-en') {
      url.searchParams.set('language', this.opts.language);
    }

    this.ws = new WebSocket(url.toString(), {
      headers: {
        Authorization: `Token ${this.env.DEEPGRAM_API_KEY}`,
      },
    } as any);

    const ws = this.ws;

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', (e) => reject(e));
    });

    ws.addEventListener('message', (evt: any) => {
      try {
        const dataStr = typeof evt.data === 'string' ? evt.data : evt.data?.toString?.();
        if (!dataStr) return;
        const msg = JSON.parse(dataStr);

        // Deepgram emits various message types.
        const alt = msg?.channel?.alternatives?.[0];
        const transcript = alt?.transcript ?? '';
        const words = alt?.words;
        const isFinal = Boolean(msg?.is_final || msg?.speech_final);

        if (transcript) {
          this.onTranscript?.({ isFinal, transcript, words, raw: msg });
        }
      } catch {
        // ignore
      }
    });
  }

  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  sendAudio(chunk: Uint8Array) {
    if (!this.ws) throw new Error('Deepgram realtime not connected');
    this.ws.send(chunk);
  }

  async close() {
    const ws = this.ws;
    if (!ws) return;
    this.ws = null;
    try {
      ws.close();
    } catch {}
  }
}
