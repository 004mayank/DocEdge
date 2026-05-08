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
    url.searchParams.set('model', 'nova-2');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('diarize', 'true');
    // 100ms endpointing: fires finals quickly after short pauses.
    url.searchParams.set('endpointing', '100');
    // No encoding/sample_rate/channels — Deepgram auto-detects from the
    // WebM/Opus container headers sent by the browser's MediaRecorder.
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
