import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { DeepgramService } from '../stt/deepgram.service';

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

  constructor(private readonly deepgram: DeepgramService) {}

  private sessions = new Map<
    string,
    {
      chunks: Buffer[];
      mimetype: string;
      language?: string;
    }
  >();

  @SubscribeMessage('start')
  async start(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { mimetype: string; language?: 'en' | 'hi' | 'hi-en' },
  ) {
    this.sessions.set(socket.id, {
      chunks: [],
      mimetype: body?.mimetype ?? 'audio/webm',
      language: body?.language,
    });
    socket.emit('ready', { ok: true });
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

    // MVP: naive "partial" by running Deepgram on accumulated audio every N chunks.
    // This is NOT true streaming; next iteration will use Deepgram realtime WS.
    if (s.chunks.length % 8 !== 0) return;

    try {
      const merged = Buffer.concat(s.chunks);
      const sttLang = s.language === 'hi-en' ? undefined : s.language;
      const out = await this.deepgram.transcribe({
        audioBuffer: merged,
        mimetype: s.mimetype,
        language: sttLang,
      });
      socket.emit('partial', { text: out.text ?? '' });
    } catch (e: any) {
      socket.emit('error', { message: e?.message ?? 'STT failed' });
    }
  }

  @SubscribeMessage('stop')
  async stop(@ConnectedSocket() socket: Socket) {
    const s = this.sessions.get(socket.id);
    if (!s) return;
    this.sessions.delete(socket.id);

    try {
      const merged = Buffer.concat(s.chunks);
      const sttLang = s.language === 'hi-en' ? undefined : s.language;
      const out = await this.deepgram.transcribe({
        audioBuffer: merged,
        mimetype: s.mimetype,
        language: sttLang,
      });
      socket.emit('final', { text: out.text ?? '' });
    } catch (e: any) {
      socket.emit('error', { message: e?.message ?? 'STT failed' });
    }
  }
}

