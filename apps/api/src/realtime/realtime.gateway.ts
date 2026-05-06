import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { DeepgramService } from '../stt/deepgram.service';
import { DeepgramRealtimeClient } from '../stt/deepgram.realtime';
import { Logger } from '@nestjs/common';

// Realtime gateway.
// Client protocol (Socket.IO):
// - emit('start', { language?: 'en'|'hi'|'hi-en', mimetype: string })
// - emit('audio', <binary chunk>) repeatedly
// - emit('stop')
// Server emits:
// - 'ready'
// - 'partial' { text: string }
// - 'final'   { text: string, segments: [{speaker: number, text: string}] }
// - 'error'   { message: string }

@WebSocketGateway({
  path: '/ws',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly deepgram: DeepgramService) {}

  private sessions = new Map<
    string,
    {
      chunks: Buffer[];
      mimetype: string;
      language?: string;
      dg?: DeepgramRealtimeClient;
    }
  >();

  @SubscribeMessage('start')
  async start(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { mimetype: string; language?: 'en' | 'hi' | 'hi-en' },
  ) {
    const mimetype = body?.mimetype ?? 'audio/webm;codecs=opus';
    const language = body?.language;

    this.logger.log(`start socket=${socket.id} mimetype=${mimetype} lang=${language ?? ''}`);

    const dg = new DeepgramRealtimeClient({ mimetype, language });
    this.sessions.set(socket.id, { chunks: [], mimetype, language, dg });
    socket.emit('ready', { ok: true });

    (async () => {
      try {
        await dg.connect((evt) => {
          // Build speaker-labelled segments from word-level diarization.
          // Each run of consecutive words with the same speaker becomes a segment.
          const segments: Array<{ speaker: number; text: string }> = [];
          const words = evt.words ?? [];

          if (words.length > 0) {
            let cur: { speaker: number; text: string } | null = null;
            for (const w of words) {
              const sid = typeof w.speaker === 'number' ? w.speaker : 0;
              const token = w.word;
              if (!token) continue;
              if (!cur || cur.speaker !== sid) {
                if (cur) segments.push(cur);
                cur = { speaker: sid, text: token };
              } else {
                cur.text = `${cur.text} ${token}`;
              }
            }
            if (cur) segments.push(cur);
          } else if (evt.transcript) {
            // No word-level data — emit as speaker 0 (will be re-attributed by AI on save)
            segments.push({ speaker: 0, text: evt.transcript });
          }

          socket.emit(evt.isFinal ? 'final' : 'partial', {
            text: evt.transcript,
            segments: evt.isFinal ? segments : [],
            isFinal: evt.isFinal,
          });
        });

        this.logger.log(`deepgram connected socket=${socket.id}`);
      } catch (e: any) {
        this.logger.error(`deepgram connect failed socket=${socket.id} err=${e?.message ?? e}`);
        socket.emit('error', {
          message: `Deepgram realtime connect failed: ${e?.message ?? e}`,
        });
      }
    })();
  }

  @SubscribeMessage('audio')
  async audio(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const s = this.sessions.get(socket.id);
    if (!s) {
      socket.emit('error', { message: 'Session not started' });
      return;
    }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    s.chunks.push(buf);

    try {
      if (s.dg && !s.dg.isConnected()) return;
      s.dg?.sendAudio(new Uint8Array(buf));
    } catch (e: any) {
      this.logger.warn(`sendAudio failed socket=${socket.id} err=${e?.message ?? e}`);
      socket.emit('error', { message: e?.message ?? 'Realtime STT failed' });
    }
  }

  @SubscribeMessage('stop')
  async stop(@ConnectedSocket() socket: Socket) {
    const s = this.sessions.get(socket.id);
    if (!s) return;
    this.sessions.delete(socket.id);
    try {
      await s.dg?.close();
    } catch (e: any) {
      socket.emit('error', { message: e?.message ?? 'Failed to close realtime STT' });
    }
  }
}
