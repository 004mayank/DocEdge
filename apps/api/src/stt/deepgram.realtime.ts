import { loadEnv } from '../config/env';
import WebSocket from 'ws';

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
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private onTranscript: ((e: DeepgramRealtimeTranscriptEvent) => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  constructor(private opts: DeepgramRealtimeOptions) {}

  async connect(
    onTranscript: (e: DeepgramRealtimeTranscriptEvent) => void,
    onDisconnect?: () => void,
  ) {
    if (!this.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not set');

    this.onTranscript = onTranscript;
    this.onDisconnect = onDisconnect ?? null;

    const url = new URL('wss://api.deepgram.com/v1/listen');
    // nova-2-medical is trained on clinical speech — dramatically better accuracy
    // for medical terms like "headache", "hypertension", drug names, etc.
    url.searchParams.set('model', 'nova-2-medical');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('smart_format', 'true'); // improves accuracy + formatting
    // diarize omitted — adds server latency; speaker labels assigned by AI post-processing.
    url.searchParams.set('interim_results', 'true');
    // 500 ms endpointing: waits for a natural phrase boundary before firing a final.
    // Partials (interim_results=true) still update the Live bubble every ~200 ms —
    // endpointing only controls when a segment is committed as a final utterance.
    // 100 ms was too aggressive and split single sentences into many micro-segments.
    url.searchParams.set('endpointing', '500');

    // Raw PCM-16 path (AudioWorklet): must declare encoding explicitly.
    // WebM/Opus path: Deepgram auto-detects from container headers.
    const isPCM =
      this.opts.mimetype?.includes('l16') ||
      this.opts.mimetype?.includes('pcm') ||
      this.opts.mimetype === 'audio/raw';
    if (isPCM) {
      url.searchParams.set('encoding', 'linear16');
      url.searchParams.set('sample_rate', '16000');
      url.searchParams.set('channels', '1');
    }

    if (this.opts.language && this.opts.language !== 'hi-en') {
      url.searchParams.set('language', this.opts.language);
    }

    this.ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Token ${this.env.DEEPGRAM_API_KEY}` },
    } as any);

    const ws = this.ws;

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (e: any) => reject(e));
    });

    // Deepgram closes the connection after ~12s without audio data.
    // Send a KeepAlive every 8s to keep it alive during silence/pauses.
    this.keepAliveTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 8000);

    ws.on('message', (data: any) => {
      try {
        const dataStr = typeof data === 'string' ? data : data?.toString?.();
        if (!dataStr) return;
        const msg = JSON.parse(dataStr);

        const alt = msg?.channel?.alternatives?.[0];
        if (!alt) return;

        const transcript = alt.transcript ?? '';
        if (!transcript) return;

        const words = alt.words;
        const isFinal = Boolean(msg?.is_final || msg?.speech_final);

        this.onTranscript?.({ isFinal, transcript, words, raw: msg });
      } catch {
        // ignore parse errors
      }
    });

    ws.on('close', () => {
      this._cleanup();
      this.onDisconnect?.();
    });

    ws.on('error', () => {
      this._cleanup();
      this.onDisconnect?.();
    });
  }

  private _cleanup() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    this.ws = null;
  }

  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  sendAudio(chunk: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(chunk);
  }

  async close() {
    this._cleanup();
    const ws = this.ws;
    if (!ws) return;
    try { ws.close(); } catch {}
  }
}
