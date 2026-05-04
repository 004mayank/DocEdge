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

// Minimal realtime gateway.
// Client protocol (Socket.IO):
// - emit('start', { language?: 'en'|'hi'|'hi-en', mimetype: string })
// - emit('audio', <binary chunk>) repeatedly
// - emit('stop')
// Server emits:
// - 'partial' { text: string }
// - 'final' { text: string }
// - 'error' { message: string }

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

    // Create session and ACK immediately so the client can start streaming.
    const dg = new DeepgramRealtimeClient({ mimetype, language });
    this.sessions.set(socket.id, {
      chunks: [],
      mimetype,
      language,
      dg,
    });
    socket.emit('ready', { ok: true });

    // Connect to Deepgram asynchronously. If it fails, report to client.
    (async () => {
      try {
        await dg.connect((evt) => {
          const words = evt.words ?? [];
          const segments: Array<{ speaker: number; text: string }> = [];
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

          socket.emit(evt.isFinal ? 'final' : 'partial', {
            text: evt.transcript,
            segments,
            isFinal: evt.isFinal,
          });
        });

        this.logger.log(`deepgram connected socket=${socket.id}`);
      } catch (e: any) {
        this.logger.error(
          `deepgram connect failed socket=${socket.id} err=${e?.message ?? e}`,
        );
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
    // Socket.IO delivers binary as Buffer on Node.
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    s.chunks.push(buf);

    if (s.chunks.length === 1) {
      this.logger.log(`first audio socket=${socket.id} bytes=${buf.length}`);
    }

    try {
      // If deepgram isn't connected yet, drop audio silently (client will keep sending).
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
