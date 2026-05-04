'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';
import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '@/lib/api';

type State = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

export default function ConsultPage({ params }: { params: { id: string } }) {
  const patientId = useMemo(() => params.id, [params.id]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const audioSeqRef = useRef<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef<number>(0);
  const historyRef = useRef<number[]>([]);
  const lastTsRef = useRef<number>(0);

  const [state, setState] = useState<State>('idle');
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [inputLanguage, setInputLanguage] = useState<'en' | 'hi' | 'hi-en'>('en');
  const [soap, setSoap] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [contentType, setContentType] = useState<string>('audio/webm');
  const [liveText, setLiveText] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [meter, setMeter] = useState<number[]>(Array.from({ length: 10 }, () => 0));

  useEffect(() => {
    const t = loadToken();
    if (!t) window.location.href = '/login';

    // Pick a stable recording mimeType for this browser.
    const preferred = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    const picked =
      typeof MediaRecorder !== 'undefined'
        ? preferred.find((t) => MediaRecorder.isTypeSupported(t))
        : undefined;
    if (picked) setContentType(picked);

    return () => {
      try {
        socketRef.current?.disconnect();
      } catch {}
      try {
        procRef.current?.disconnect();
      } catch {}
      try {
        audioCtxRef.current?.close();
      } catch {}
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function fmt(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  }

  function downsampleTo16k(float32: Float32Array, inSampleRate: number) {
    const outSampleRate = 16000;
    if (inSampleRate === outSampleRate) return float32;
    const ratio = inSampleRate / outSampleRate;
    const newLen = Math.round(float32.length / ratio);
    const result = new Float32Array(newLen);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32.length; i++) {
        accum += float32[i];
        count++;
      }
      result[offsetResult] = accum / (count || 1);
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  function floatTo16BitPCM(float32: Float32Array) {
    const buf = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buf);
  }

  function fail(err: any, fallback: string) {
    const msg =
      err?.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow mic access in your browser settings and try again.'
        : err?.name === 'NotFoundError'
          ? 'No microphone found. Connect/select an input device and try again.'
          : err?.message ?? fallback;
    setState('error');
    setMessage(msg);
  }

  async function start() {
    try {
      setMessage('');
      setSoap(null);
      setInsights(null);
      setLiveText('');

      // Ask for mic access *before* creating a consultation, so we don't leave
      // orphaned "active" consultations when the mic is unavailable.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await api.post('/consultations/start', {
        patientId,
        inputLanguage,
      });
      setConsultationId(res.data.id);

      const recorder = contentType
        ? new MediaRecorder(stream, { mimeType: contentType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      // Realtime transcript: connect and wait for server 'ready' before sending audio.
      const sock = io(getApiOrigin() || window.location.origin, {
        path: '/ws',
        transports: ['websocket'],
      });
      socketRef.current = sock;

      const ready = new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Realtime STT handshake timeout')), 8000);
        sock.on('ready', () => {
          clearTimeout(t);
          resolve();
        });
      });

      sock.on('connect', () => {
        sock.emit('start', {
          mimetype: contentType || 'audio/webm',
          language: inputLanguage,
        });
      });
      sock.on('connect_error', (e: any) => {
        setMessage(`Realtime connect error: ${e?.message ?? e}`);
      });
      sock.on('disconnect', (reason: any) => {
        setMessage(`Realtime disconnected: ${reason}`);
      });
      const renderSegments = (p: any) => {
        if (Array.isArray(p?.segments) && p.segments.length) {
          const lines = p.segments
            .map((s: any) =>
              s.speaker === -1
                ? `[${s.text}]`
                : `Speaker ${s.speaker}: ${s.text}`,
            )
            .join('\n');
          setLiveText(lines);
        } else if (typeof p?.text === 'string') {
          // Fast path: show interim transcript even if diarization segments aren't ready.
          setLiveText(p.text);
        }
      };

      sock.on('partial', renderSegments);
      sock.on('final', renderSegments);
      sock.on('error', (e: any) => {
        // Keep recording even if realtime STT hiccups
        const msg = e?.message ? `Realtime STT: ${e.message}` : 'Realtime STT error';
        setMessage(msg);
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      await ready;

      // Start PCM realtime streaming (linear16 @ 16kHz mono)
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
      const audioCtx: AudioContext = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);

      // Listening meter
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;
      src.connect(analyser);

      // Smaller buffer => lower latency for realtime captions.
      const proc = audioCtx.createScriptProcessor(1024, 1, 1);
      procRef.current = proc;

      proc.onaudioprocess = (evt) => {
        const input = evt.inputBuffer.getChannelData(0);
        const down = downsampleTo16k(input, audioCtx.sampleRate);
        const pcm16 = floatTo16BitPCM(down);
        const s = socketRef.current;
        if (s && s.connected) {
          audioSeqRef.current += 1;
          s.emit('audio', pcm16);
        }
      };

      src.connect(proc);
      proc.connect(audioCtx.destination);

      // Animate bars + waveform from analyser
      const freq = new Uint8Array(analyser.frequencyBinCount);
      const time = new Uint8Array(analyser.fftSize);
      const loop = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(freq);
        // Build 10 bars from low-mid frequencies
        const bars = 10;
        const out: number[] = [];
        for (let i = 0; i < bars; i++) {
          const start = Math.floor((i * freq.length) / bars);
          const end = Math.floor(((i + 1) * freq.length) / bars);
          let sum = 0;
          let cnt = 0;
          for (let j = start; j < end; j++) {
            sum += freq[j];
            cnt++;
          }
          // normalize 0..1
          out.push(Math.min(1, (sum / (cnt || 1)) / 255));
        }
        setMeter(out);

        // Rolling waveform
        const canvas = canvasRef.current;
        if (canvas) {
          const dpr = window.devicePixelRatio || 1;
          const cssW = canvas.clientWidth || 700;
          const cssH = canvas.clientHeight || 80;
          const w = Math.floor(cssW * dpr);
          const h = Math.floor(cssH * dpr);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            a.getByteTimeDomainData(time);

            // Compute RMS level from time-domain data (0..1)
            let sumSq = 0;
            for (let i = 0; i < time.length; i++) {
              const v = (time[i] - 128) / 128; // -1..1
              sumSq += v * v;
            }
            const rms = Math.sqrt(sumSq / time.length);

            // Time-aware attack/release with slow decay (so it doesn't flatline quickly)
            const now = performance.now();
            const dt = Math.max(0.001, (now - (lastTsRef.current || now)) / 1000);
            lastTsRef.current = now;

            const prev = levelRef.current || 0;
            const attackTau = 0.12; // ~120ms
            const releaseTau = 1.4; // ~1.4s
            const attackA = 1 - Math.exp(-dt / attackTau);
            const releaseA = 1 - Math.exp(-dt / releaseTau);
            const coeff = rms > prev ? attackA : releaseA;
            const next = prev + (rms - prev) * coeff;
            levelRef.current = next;

            // Visual envelope + history
            const minLevel = 0.08;
            const gain = 5.0;
            const env = Math.max(minLevel, Math.min(1, next * gain));

            const hist = historyRef.current;
            hist.push(env);
            const maxPoints = 240; // ~8s @ ~30fps
            if (hist.length > maxPoints) hist.splice(0, hist.length - maxPoints);
            ctx.clearRect(0, 0, w, h);

            // background
            ctx.fillStyle = '#0b0f19';
            ctx.fillRect(0, 0, w, h);

            const mid = h / 2;
            // flatline
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.lineWidth = 1 * dpr;
            ctx.beginPath();
            ctx.moveTo(0, mid);
            ctx.lineTo(w, mid);
            ctx.stroke();

            // waveform gradient
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, '#22d3ee');
            grad.addColorStop(0.5, '#a855f7');
            grad.addColorStop(1, '#22d3ee');
            ctx.strokeStyle = grad;
            ctx.lineWidth = (2.5 + env * 1.2) * dpr;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            // Scrolling envelope waveform (top + mirrored bottom)
            const arr = historyRef.current;
            const n = arr.length;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
              const x = n <= 1 ? 0 : (i / (n - 1)) * w;
              const amp = arr[i];
              const y = mid - (h * 0.38) * amp;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
              const x = n <= 1 ? 0 : (i / (n - 1)) * w;
              const amp = arr[i];
              const y = mid + (h * 0.38) * amp;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);

      // Emit chunks frequently for realtime STT.
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setState('recording');

      startedAtRef.current = Date.now();
      setElapsedSec(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (!startedAtRef.current) return;
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err: any) {
      fail(err, 'Failed to start recording');
    }
  }

  async function stop() {
    try {
      if (!consultationId) return;
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      setState('uploading');

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Stop realtime
      try {
        socketRef.current?.emit('stop');
        socketRef.current?.disconnect();
      } catch {}

      await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const blob = new Blob(chunksRef.current, { type: contentType || 'audio/webm' });

    const pres = await api.post('/uploads/presign', {
      kind: 'audio',
      patientId,
      consultationId,
      contentType: contentType || 'audio/webm',
      originalName: `consultation-${consultationId}.${(contentType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm'}`,
    });

    const presign = pres.data.presign;
    const objectKey = pres.data.object.key;

    await fetch(presign.url, {
      method: 'PUT',
      headers: { 'content-type': contentType || 'audio/webm' },
      body: blob,
    });

    // Register artifact (optional but useful for timeline)
    await api.post('/uploads/register', {
      kind: 'audio',
      patientId,
      consultationId,
      objectKey,
      contentType: contentType || 'audio/webm',
      originalName: `consultation-${consultationId}.${(contentType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm'}`,
    });

    await api.post(`/consultations/${consultationId}/stop`, {
      audioObjectKey: objectKey,
      language: 'en',
    });

      setState('processing');
      setMessage('Processing…');

    // Poll status
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const s = await api.get(`/consultations/${consultationId}/status`);
        if (s.data.status === 'completed') break;
        if (s.data.status === 'failed') {
          throw new Error(
            s.data.error?.message ??
              'Consultation processing failed (see server logs for details)',
          );
        }
      }

      const full = await api.get(`/consultations/${consultationId}`);
      setSoap(full.data.soapNote);
      setInsights(full.data.aiInsights);
      setState('done');
      setMessage('Done');
      if (intervalRef.current) clearInterval(intervalRef.current);
      startedAtRef.current = null;

      analyserRef.current = null;
      procRef.current = null;
      audioCtxRef.current = null;
    } catch (err: any) {
      fail(err, 'Failed to stop/upload/process consultation');
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <a className="text-sm underline" href={`/patients/${patientId}`}>
        ← Back to patient
      </a>

      <h1 className="text-2xl font-semibold mt-3">Consultation</h1>
      <p className="text-sm text-gray-600 mt-1">
        Patient: <span className="font-mono">{patientId}</span>
      </p>

      <div className="mt-6 border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm">
            Spoken language:&nbsp;
            <select
              className="border rounded px-2 py-1"
              value={inputLanguage}
              onChange={(e) => setInputLanguage(e.target.value as any)}
              disabled={state === 'recording' || state === 'uploading' || state === 'processing'}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hi-en">Hinglish</option>
            </select>
          </div>
          <button
            disabled={state !== 'idle' && state !== 'done' && state !== 'error'}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            onClick={start}
          >
            Start
          </button>
          <button
            disabled={state !== 'recording'}
            className="border rounded px-4 py-2 disabled:opacity-50"
            onClick={stop}
          >
            Stop
          </button>
          <div className="text-sm text-gray-700">State: {state}</div>
          {state === 'recording' && (
            <div className="flex items-center gap-3">
              <div className="w-full max-w-xl">
                <canvas
                  ref={(el) => {
                    canvasRef.current = el;
                  }}
                  className="w-full h-16 rounded-lg border border-white/10"
                />
              </div>
              <div className="text-base font-medium text-gray-800">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mr-2" />
                Listening <span className="font-mono">{fmt(elapsedSec)}</span>
              </div>
            </div>
          )}
        </div>
        {consultationId && (
          <div className="mt-3 text-sm text-gray-600">
            Consultation ID: <span className="font-mono">{consultationId}</span>
          </div>
        )}
        {message && <div className="mt-3 text-sm">{message}</div>}
      </div>

      <section className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Live transcript</h2>
        <p className="mt-2 text-sm text-gray-600">
          Updates while recording (MVP). Final transcript is saved on Stop.
        </p>
        <div className="mt-3 text-sm whitespace-pre-wrap min-h-[80px]">
          {liveText || (state === 'recording' ? 'Listening…' : '—')}
        </div>
      </section>

      {soap && (
        <section className="mt-8 border rounded-xl p-4">
          <h2 className="font-semibold">SOAP note</h2>
          <div className="mt-3 grid gap-3 text-sm">
            <div>
              <div className="font-medium">Subjective</div>
              <div className="text-gray-700 whitespace-pre-wrap">{soap.subjective}</div>
            </div>
            <div>
              <div className="font-medium">Objective</div>
              <div className="text-gray-700 whitespace-pre-wrap">{soap.objective}</div>
            </div>
            <div>
              <div className="font-medium">Assessment</div>
              <div className="text-gray-700 whitespace-pre-wrap">{soap.assessment}</div>
            </div>
            <div>
              <div className="font-medium">Plan</div>
              <div className="text-gray-700 whitespace-pre-wrap">{soap.plan}</div>
            </div>
          </div>
        </section>
      )}

      {insights && (
        <section className="mt-6 border rounded-xl p-4">
          <h2 className="font-semibold">Insights (assistive)</h2>
          <pre className="mt-3 text-xs overflow-auto bg-gray-50 p-3 rounded">
            {JSON.stringify(insights, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
