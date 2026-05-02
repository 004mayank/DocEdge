'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';

export default function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const id = useMemo(() => params.id, [params.id]);
  const [c, setC] = useState<any>(null);
  const [soap, setSoap] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await api.get(`/consultations/${id}`);
    setC(res.data);
    setSoap(res.data.soapNote ?? { subjective: '', objective: '', assessment: '', plan: '' });
  }, [id]);

  useEffect(() => {
    const t = loadToken();
    if (!t) window.location.href = '/login';

    (async () => {
      try {
        await refresh();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e.message ?? 'Failed');
      }
    })();

    const interval = window.setInterval(async () => {
      try {
        const s = await api.get(`/consultations/${id}/status`);
        if (s.data.status !== 'completed') return;
        await refresh();
        window.clearInterval(interval);
      } catch {
        // ignore
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [id, refresh]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/consultations/${id}/soap`, { soapNote: soap });
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <a className="text-sm underline" href={c?.patientId ? `/patients/${c.patientId}` : '/patients'}>
        ← Back
      </a>

      <h1 className="text-2xl font-semibold mt-3">Consultation</h1>
      <div className="mt-2 text-sm text-gray-600 font-mono">{id}</div>
      <div className="mt-2 text-sm">Status: {c?.status ?? '...'}</div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <section className="mt-6 border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">SOAP (editable)</h2>
          <button
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
            <div key={k}>
              <div className="text-sm font-medium capitalize">{k}</div>
              <textarea
                className="mt-1 w-full border rounded px-3 py-2 min-h-24"
                value={soap?.[k] ?? ''}
                onChange={(e) => setSoap((s: any) => ({ ...(s ?? {}), [k]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Transcript</h2>
        <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">
          {(() => {
            const t = c?.normalizedTranscriptEn ?? c?.transcript;
            if (!t) return 'No transcript yet.';
            if (typeof t.text === 'string' && t.text.trim().length) return t.text;
            const segs = Array.isArray(t.segments) ? t.segments : [];
            if (!segs.length) return 'Transcript empty.';
            return segs
              .map((s: any) => {
                const t0 = typeof s.t0 === 'number' ? s.t0.toFixed(1) : '';
                const t1 = typeof s.t1 === 'number' ? s.t1.toFixed(1) : '';
                const sp = s.speaker ? String(s.speaker) : 'speaker';
                const time = t0 && t1 ? `[${t0}s-${t1}s] ` : '';
                return `${time}${sp}: ${s.text ?? ''}`;
              })
              .join('\n\n');
          })()}
        </div>
      </section>

      <section className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">AI insights</h2>
        <pre className="mt-3 text-xs overflow-auto bg-gray-50 p-3 rounded">
          {JSON.stringify(c?.aiInsights ?? null, null, 2)}
        </pre>
      </section>
    </main>
  );
}
