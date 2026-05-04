'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';

type State = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

export default function ConsultPage({ params }: { params: { id: string } }) {
  const patientId = useMemo(() => params.id, [params.id]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [state, setState] = useState<State>('idle');
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [inputLanguage, setInputLanguage] = useState<'en' | 'hi' | 'hi-en'>('en');
  const [soap, setSoap] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    const t = loadToken();
    if (!t) window.location.href = '/login';
  }, []);

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

      // Ask for mic access *before* creating a consultation, so we don't leave
      // orphaned "active" consultations when the mic is unavailable.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await api.post('/consultations/start', {
        patientId,
        inputLanguage,
      });
      setConsultationId(res.data.id);

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState('recording');
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

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

    const pres = await api.post('/uploads/presign', {
      kind: 'audio',
      patientId,
      consultationId,
      contentType: 'audio/webm',
      originalName: `consultation-${consultationId}.webm`,
    });

    const presign = pres.data.presign;
    const objectKey = pres.data.object.key;

    await fetch(presign.url, {
      method: 'PUT',
      headers: { 'content-type': 'audio/webm' },
      body: blob,
    });

    // Register artifact (optional but useful for timeline)
    await api.post('/uploads/register', {
      kind: 'audio',
      patientId,
      consultationId,
      objectKey,
      contentType: 'audio/webm',
      originalName: `consultation-${consultationId}.webm`,
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
        </div>
        {consultationId && (
          <div className="mt-3 text-sm text-gray-600">
            Consultation ID: <span className="font-mono">{consultationId}</span>
          </div>
        )}
        {message && <div className="mt-3 text-sm">{message}</div>}
      </div>

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
