'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';
import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';

type State = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

type ChatSegment = { id: number; speaker: number; text: string; ts?: number };

type LiveInsight = { type: 'symptom' | 'history'; title: string; desc: string };

const SYMPTOM_CUES: [string, string, string][] = [
  ['chest', 'Chest Tightness', 'Patient reports chest-related symptoms'],
  ['pain', 'Pain Reported', 'Patient mentions pain or discomfort'],
  ['fatigue', 'Fatigue', 'Patient reports tiredness or fatigue'],
  ['breath', 'Breathing Difficulty', 'Respiratory symptoms mentioned'],
  ['fever', 'Elevated Temperature', 'Fever or high temperature mentioned'],
  ['headache', 'Headache', 'Patient reports headache'],
  ['nausea', 'Nausea / Vomiting', 'GI symptoms mentioned'],
  ['dizzy', 'Dizziness', 'Patient reports dizziness or vertigo'],
  ['cough', 'Cough', 'Persistent cough mentioned'],
  ['sugar', 'Blood Sugar', 'Diabetes or sugar level mentioned'],
  ['bp', 'Blood Pressure', 'Blood pressure concern mentioned'],
  ['allerg', 'Allergy', 'Allergy mentioned'],
];

const SOAP_TEMPLATES = [
  'Standard General Consultation',
  'Cardiology Follow-up',
  'Diabetes Management',
  'Respiratory Assessment',
  'Orthopaedic Consultation',
  'Mental Health Check-in',
];

export default function ConsultPage({ params }: { params: { id: string } }) {
  const patientId = useMemo(() => params.id, [params.id]);

  // ── Refs ───────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const segIdRef = useRef(0);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<(() => void) | null>(null);
  const chatSegmentsRef = useRef<ChatSegment[]>([]);
  const partialTextRef = useRef<string>('');

  // ── State ──────────────────────────────────────────────────────
  const [state, setState] = useState<State>('idle');
  const [patient, setPatient] = useState<any>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [inputLanguage, setInputLanguage] = useState<'en' | 'hi' | 'hi-en'>('en');
  const [soap, setSoap] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [contentType, setContentType] = useState<string>('audio/webm');
  const [chatSegments, setChatSegments] = useState<ChatSegment[]>([]);
  const [partialText, setPartialText] = useState('');
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [paused, setPaused] = useState(false);
  const [waveLevel, setWaveLevel] = useState(0);
  const [liveInsights, setLiveInsights] = useState<LiveInsight[]>([]);
  const [prevArtifacts, setPrevArtifacts] = useState<any[]>([]);
  const [soapTemplate, setSoapTemplate] = useState(SOAP_TEMPLATES[0]);

  // ── On mount ───────────────────────────────────────────────────
  useEffect(() => {
    const t = loadToken();
    if (!t) { window.location.href = '/login'; return; }

    const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    const picked = typeof MediaRecorder !== 'undefined'
      ? preferred.find(t => MediaRecorder.isTypeSupported(t))
      : undefined;
    if (picked) setContentType(picked);

    (async () => {
      try {
        const [p, as] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/patients/${patientId}/artifacts`),
        ]);
        setPatient(p.data);
        setPrevArtifacts((as.data.items ?? []).filter((a: any) => a.kind !== 'audio'));
      } catch {}

      // Auto-start if navigated from patient detail with ?autostart=1
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1') {
        setTimeout(() => startRef.current?.(), 300);
      }
    })();

    return () => {
      try { socketRef.current?.disconnect(); } catch {}
      try { procRef.current?.disconnect(); } catch {}
      try { audioCtxRef.current?.close(); } catch {}
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [patientId]);

  // ── Live insight extraction ───────────────────────────────────
  useEffect(() => {
    const text = chatSegments.map(s => s.text).join(' ').toLowerCase();
    const found: LiveInsight[] = [];
    for (const [term, title, desc] of SYMPTOM_CUES) {
      if (text.includes(term) && !found.find(i => i.title === title)) {
        found.push({ type: 'symptom', title, desc });
      }
    }
    setLiveInsights(found);
  }, [chatSegments]);

  // ── Auto-scroll transcript ────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSegments, partialText]);

  // ── Sync refs ─────────────────────────────────────────────────
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { chatSegmentsRef.current = chatSegments; }, [chatSegments]);
  useEffect(() => { partialTextRef.current = partialText; }, [partialText]);

  // ── Helpers ───────────────────────────────────────────────────
  function fmt(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function downsampleTo16k(float32: Float32Array, inSampleRate: number) {
    if (inSampleRate === 16000) return float32;
    const ratio = inSampleRate / 16000;
    const newLen = Math.round(float32.length / ratio);
    const result = new Float32Array(newLen);
    let oR = 0, oB = 0;
    while (oR < result.length) {
      const next = Math.round((oR + 1) * ratio);
      let sum = 0, cnt = 0;
      for (let i = oB; i < next && i < float32.length; i++) { sum += float32[i]; cnt++; }
      result[oR++] = sum / (cnt || 1);
      oB = next;
    }
    return result;
  }

  function floatTo16BitPCM(f32: Float32Array) {
    const buf = new ArrayBuffer(f32.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buf);
  }

  function fail(err: any, fallback: string) {
    const msg =
      err?.name === 'NotAllowedError' ? 'Microphone permission denied. Allow mic access and try again.'
      : err?.name === 'NotFoundError' ? 'No microphone found.'
      : err?.message ?? fallback;
    setState('error');
    setMessage(msg);
  }

  // ── Start recording ───────────────────────────────────────────
  // Keep a stable ref so the autostart timeout can call it after mount
  useEffect(() => { startRef.current = start; });

  async function start() {
    try {
      setMessage('');
      setSoap(null);
      setInsights(null);
      setChatSegments([]);
      setPartialText('');
      setPaused(false);

      // ── 1. Get microphone ──────────────────────────────────────────────
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // ── 2. Create AudioContext at the native system rate ───────────────
      // Do NOT force 16 kHz here — macOS Chrome may silently ignore the hint
      // and stay at 44 100/48 000 Hz, causing a speed mismatch with Deepgram.
      // The AudioWorklet processor downsamples to 16 kHz internally so Deepgram
      // always gets clean 16 kHz regardless of the host rate.
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext) as any;
      const audioCtx: AudioContext = new AudioCtxClass();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      // ── 3. Probe AudioWorklet availability BEFORE connecting the socket ─
      // This lets us tell the gateway the correct mimetype up-front.
      let useWorklet = false;
      try {
        await audioCtx.audioWorklet.addModule('/audio-processor.js');
        useWorklet = true;
      } catch {
        console.warn('[DocEdge] AudioWorklet unavailable — will fall back to MediaRecorder streaming');
      }

      // ── 4. Create consultation record ─────────────────────────────────
      const res = await api.post('/consultations/start', { patientId, inputLanguage });
      setConsultationId(res.data.id);

      // ── 5. MediaRecorder (S3 upload + optional streaming fallback) ────
      const recorder = contentType
        ? new MediaRecorder(stream, { mimeType: contentType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      // ── 6. Connect Socket.IO with the correct streaming mimetype ──────
      // When the worklet is active we stream raw PCM16 → tell Deepgram.
      // Fallback: WebM/Opus from MediaRecorder — Deepgram auto-detects.
      const streamMimetype = useWorklet
        ? 'audio/l16;rate=16000'
        : (contentType || 'audio/webm');

      const sock = io(getApiOrigin() || window.location.origin, {
        path: '/ws',
        transports: ['websocket'],
      });
      socketRef.current = sock;

      const ready = new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Realtime STT handshake timeout')), 10000);
        sock.on('ready', () => { clearTimeout(t); resolve(); });
      });

      sock.on('connect', () => {
        // Pass the actual AudioContext sample rate so Deepgram knows exactly
        // what rate the PCM16 audio is at — no downsampling, no drift.
        const ctxRate = useWorklet ? Math.round(audioCtx.sampleRate) : undefined;
        sock.emit('start', { mimetype: streamMimetype, sampleRate: ctxRate, language: inputLanguage });
      });
      sock.on('connect_error', (e: any) => setMessage(`Connect error: ${e?.message ?? e}`));

      sock.on('partial', (p: any) => {
        setPartialText(p?.text ?? '');
      });

      sock.on('final', (p: any) => {
        const text: string = (p?.text ?? '').trim();
        if (!text) { setPartialText(''); return; }

        // Merge into the previous segment if it's the same speaker and arrived
        // within 2 s — avoids micro-fragments from aggressive endpointing.
        const MERGE_MS = 2000;
        const now = Date.now();

        setChatSegments(prev => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.speaker === 0 && // diarize off in realtime → all speaker 0
            (now - (last.ts ?? 0)) < MERGE_MS
          ) {
            // Append to existing bubble
            return [
              ...prev.slice(0, -1),
              { ...last, text: `${last.text} ${text}`, ts: now },
            ];
          }
          return [...prev, { id: segIdRef.current++, speaker: 0, text, ts: now }];
        });

        setPartialText('');
      });

      sock.on('error', (e: any) => setMessage(e?.message ? `Realtime STT: ${e.message}` : 'Realtime STT error'));

      // ── 7. Audio graph: microphone → analyser (visualisation) ─────────
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;
      src.connect(analyser); // analyser not connected to destination → no loopback

      // Waveform animation loop
      const time = new Uint8Array(analyser.fftSize);
      const loop = () => {
        const a = analyserRef.current;
        if (!a) { rafRef.current = requestAnimationFrame(loop); return; }
        a.getByteTimeDomainData(time);
        let sumSq = 0;
        for (let i = 0; i < time.length; i++) { const v = (time[i] - 128) / 128; sumSq += v * v; }
        const rms = Math.sqrt(sumSq / time.length);
        const now = performance.now();
        const dt = Math.max(0.001, (now - (lastTsRef.current || now)) / 1000);
        lastTsRef.current = now;
        const prev = levelRef.current || 0;
        const coeff = rms > prev ? 1 - Math.exp(-dt / 0.08) : 1 - Math.exp(-dt / 0.6);
        levelRef.current = prev + (rms - prev) * coeff;
        const env = Math.max(0.05, Math.min(1, levelRef.current * 8.0));
        setWaveLevel(env);
        rafRef.current = requestAnimationFrame(loop);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);

      // ── 8. Wait for Deepgram connection ───────────────────────────────
      await ready;

      // ── 9. Wire up real-time streaming ───────────────────────────────
      if (useWorklet) {
        // ── AudioWorklet path (preferred) ─────────────────────────────
        // Runs off the main thread; posts 100 ms PCM16 chunks.
        // Deepgram gets raw linear16 with zero container overhead → partials
        // fire within ~200 ms of speech.
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
        workletNode.port.onmessage = (evt: MessageEvent) => {
          if (pausedRef.current) return;
          const socket = socketRef.current;
          if (socket?.connected) {
            socket.emit('audio', new Uint8Array(evt.data as ArrayBuffer));
          }
        };
        // microphone → worklet (NOT connected to destination → no echo)
        src.connect(workletNode);
      }

      // MediaRecorder collects the complete audio for S3 upload.
      // In the fallback path it also streams WebM/Opus to Deepgram.
      recorder.ondataavailable = (e: BlobEvent) => {
        if (!e.data?.size) return;
        chunksRef.current.push(e.data); // always accumulate for S3
        if (!useWorklet && !pausedRef.current) {
          // Fallback: stream WebM chunks directly
          e.data.arrayBuffer().then((buf) => {
            if (!pausedRef.current) socketRef.current?.emit('audio', new Uint8Array(buf));
          });
        }
      };
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop());
      // Worklet path: coarser slices fine (only for S3).
      // Fallback path: 100 ms slices needed for streaming responsiveness.
      recorder.start(useWorklet ? 500 : 100);
      mediaRecorderRef.current = recorder;
      setState('recording');

      startedAtRef.current = Date.now();
      setElapsedSec(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (startedAtRef.current) setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err: any) {
      fail(err, 'Failed to start recording');
    }
  }

  // ── Stop recording ────────────────────────────────────────────
  async function stop() {
    try {
      if (!consultationId) return;
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      setState('uploading');

      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

      try { socketRef.current?.emit('stop'); socketRef.current?.disconnect(); } catch {}

      await new Promise<void>(resolve => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      const blob = new Blob(chunksRef.current, { type: contentType || 'audio/webm' });
      const ext = (contentType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';

      const pres = await api.post('/uploads/presign', {
        kind: 'audio', patientId, consultationId,
        contentType: contentType || 'audio/webm',
        originalName: `consultation-${consultationId}.${ext}`,
      });
      await fetch(pres.data.presign.url, {
        method: 'PUT',
        headers: { 'content-type': contentType || 'audio/webm' },
        body: blob,
      });
      await api.post('/uploads/register', {
        kind: 'audio', patientId, consultationId,
        objectKey: pres.data.object.key,
        contentType: contentType || 'audio/webm',
        originalName: `consultation-${consultationId}.${ext}`,
      });
      const segs = chatSegmentsRef.current;
      const partial = partialTextRef.current?.trim();
      // Include in-flight partial as a segment if no finals were captured yet
      const allSegs = segs.length > 0
        ? segs
        : partial ? [{ id: -1, speaker: 0, text: partial }] : [];
      await api.post(`/consultations/${consultationId}/stop`, {
        audioObjectKey: pres.data.object.key,
        language: 'en',
        realtimeTranscript: allSegs.length > 0
          ? {
              segments: allSegs.map(s => ({ speaker: s.speaker, text: s.text })),
              text: allSegs.map(s => s.text).join(' '),
            }
          : undefined,
      });

      setState('processing');
      setMessage('Generating SOAP note…');

      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const s = await api.get(`/consultations/${consultationId}/status`);
        if (s.data.status === 'completed') break;
        if (s.data.status === 'failed') {
          throw new Error(s.data.error?.message ?? 'Processing failed');
        }
      }

      const full = await api.get(`/consultations/${consultationId}`);
      setSoap(full.data.soapNote);
      setInsights(full.data.aiInsights);
      setState('done');
      setMessage('');
      startedAtRef.current = null;
      analyserRef.current = null;
    } catch (err: any) {
      fail(err, 'Failed to stop/process consultation');
    }
  }

  const isRecording = state === 'recording';
  const mrn = `MRN-${patientId.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Patient header bar ────────────────────────── */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 shrink-0">
          <a href={`/patients/${patientId}`} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>

          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs shrink-0">
            {patient?.fullName ? patient.fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : '…'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{patient?.fullName ?? '…'}</span>
              {patient && (
                <>
                  <span className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">{mrn}</span>
                  {isRecording && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 font-medium">Active Session</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Language selector (only when idle) */}
          {state === 'idle' && (
            <select
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={inputLanguage}
              onChange={e => setInputLanguage(e.target.value as any)}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hi-en">Hinglish</option>
            </select>
          )}

          {/* Live recording indicator (header badge only — no waveform here) */}
          {isRecording && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Live Recording</span>
            </div>
          )}
        </div>

        {/* ── Body: transcript + right panel ───────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: transcript ─────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Live Transcript</h2>
                {isRecording && <p className="text-xs text-gray-400 mt-0.5">Doctor &amp; Patient labels assigned after session ends</p>}
              </div>
              {chatSegments.length > 0 && (
                <span className="text-xs text-gray-400">{chatSegments.length} utterances</span>
              )}
            </div>

            {/* Waveform + timer strip */}
            {isRecording && (
              <div className="bg-gray-950 px-5 flex items-center gap-4 shrink-0 border-b border-gray-800" style={{ height: '64px' }}>
                {/* CSS bar waveform */}
                <div className="flex-1 flex items-center justify-center gap-0.5 h-10 overflow-hidden">
                  {Array.from({ length: 48 }).map((_, i) => {
                    const phase = (i / 48) * Math.PI * 2;
                    const noise = Math.sin(phase * 3.7 + Date.now() * 0.003) * 0.3 + Math.sin(phase * 7.1 + Date.now() * 0.005) * 0.2;
                    const h = paused ? 0.05 : Math.max(0.06, Math.min(1, waveLevel * (0.6 + noise)));
                    const hpx = Math.round(h * 36);
                    const opacity = 0.5 + h * 0.5;
                    return (
                      <div
                        key={i}
                        style={{ height: `${hpx}px`, opacity, transition: 'height 80ms ease, opacity 80ms ease' }}
                        className="w-1 rounded-full bg-gradient-to-t from-blue-400 to-violet-400 shrink-0"
                      />
                    );
                  })}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-mono font-bold text-white leading-none tracking-tight">
                    {fmt(elapsedSec)}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">
                    {paused ? 'Paused' : 'Duration'}
                  </div>
                </div>
              </div>
            )}

            {/* Chat bubbles */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {state === 'idle' && chatSegments.length === 0 && soap === null && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                  <svg className="mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-500">Ready to record</p>
                  <p className="text-xs mt-1">Press Start Recording to begin the consultation</p>
                </div>
              )}

              {chatSegments.map(seg => (
                <div key={seg.id} className="space-y-0.5">
                  <div className={`text-xs font-semibold uppercase tracking-wider ${seg.speaker === 0 ? 'text-blue-700' : 'text-violet-600'}`}>
                    Speaker {seg.speaker + 1}
                  </div>
                  <div className={`inline-block max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    seg.speaker === 0
                      ? 'bg-white border border-gray-100 text-gray-800 shadow-sm'
                      : 'bg-violet-50 border border-violet-100 text-gray-800'
                  }`}>
                    {seg.text}
                  </div>
                  <div className="text-xs text-gray-300">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}

              {/* Partial — rendered as a live chat bubble so users see words as they speak */}
              {isRecording && partialText && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Live
                  </div>
                  <div className="inline-block max-w-[85%] bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-gray-700 leading-relaxed">
                    {partialText}
                  </div>
                </div>
              )}

              {isRecording && !partialText && chatSegments.length === 0 && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  Listening…
                </div>
              )}

              {(state === 'uploading' || state === 'processing') && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
                  <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {state === 'uploading' ? 'Uploading audio…' : message || 'Generating SOAP note…'}
                </div>
              )}

              {state === 'error' && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">{message}</div>
              )}

              {/* SOAP result */}
              {soap && (
                <div className="mt-4 bg-white border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-sm font-semibold text-emerald-800">SOAP Note Generated</span>
                  </div>
                  <div className="p-4 grid gap-3 text-sm">
                    {(['subjective', 'objective', 'assessment', 'plan'] as const).map(k => (
                      soap[k] ? (
                        <div key={k}>
                          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{k}</div>
                          <div className="text-gray-700 leading-relaxed">{soap[k]}</div>
                        </div>
                      ) : null
                    ))}
                  </div>
                  <div className="px-4 pb-4">
                    <a
                      href={`/consultations/${consultationId}`}
                      className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                    >
                      Open full consultation →
                    </a>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* ── Bottom action bar ─────────────────────── */}
            <div className="bg-white border-t border-gray-100 px-5 py-4 shrink-0">
              {state === 'idle' || state === 'done' || state === 'error' ? (
                <button
                  onClick={start}
                  className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                  </svg>
                  {state === 'done' ? 'Start New Consultation' : 'Start Recording'}
                </button>
              ) : state === 'recording' ? (
                <div className="flex gap-3">
                  <button
                    onClick={stop}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                    End Session & Generate SOAP Note
                  </button>
                  <button
                    onClick={() => {
                      const next = !paused;
                      setPaused(next);
                      if (next) mediaRecorderRef.current?.pause();
                      else mediaRecorderRef.current?.resume();
                    }}
                    className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium border transition-colors ${
                      paused
                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {paused ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        Resume
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        Pause
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Right panel ──────────────────────────────── */}
          <div className="w-72 shrink-0 overflow-y-auto bg-white flex flex-col divide-y divide-gray-50">

            {/* Live AI Insights */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Live AI Insights</h3>
              </div>

              {liveInsights.length === 0 ? (
                <div className="text-xs text-gray-400 italic">
                  {isRecording ? 'Analyzing conversation…' : 'Insights appear as you record'}
                </div>
              ) : (
                <div className="space-y-2">
                  {liveInsights.slice(0, 4).map((ins, i) => (
                    <div key={i} className="border-l-2 border-blue-400 bg-blue-50 rounded-r-lg px-3 py-2">
                      <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{ins.type === 'symptom' ? 'Possible Symptom' : 'Relevant History'}</div>
                      <div className="text-sm font-medium text-gray-800 mt-0.5">{ins.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{ins.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previous Records */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Previous Records</h3>
              {prevArtifacts.length === 0 ? (
                <div className="text-xs text-gray-400">No records on file</div>
              ) : (
                <div className="space-y-2">
                  {prevArtifacts.slice(0, 4).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <svg className="text-gray-400 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="flex-1 truncate text-gray-700">{a.originalName ?? a.kind}</span>
                      <span className="text-gray-400 shrink-0">
                        {new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <a href={`/patients/${patientId}`} className="text-xs text-blue-700 hover:text-blue-900 font-medium block mt-1">
                    View Full History →
                  </a>
                </div>
              )}
            </div>

            {/* SOAP Template */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">SOAP Template</h3>
              <select
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={soapTemplate}
                onChange={e => setSoapTemplate(e.target.value)}
                disabled={state === 'recording' || state === 'processing'}
              >
                {SOAP_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-2">AI formats the note based on this template.</p>
            </div>

            {/* AI insights after processing */}
            {insights && (
              <div className="p-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Clinical Flags</h3>
                {insights.warnings?.map((w: string, i: number) => (
                  <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-1">{w}</div>
                ))}
                {insights.actions?.map((a: any, i: number) => (
                  <div key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 mb-1">
                    <span className="font-medium">{a.title}</span>
                    {a.why ? <span className="text-gray-400"> — {a.why}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
