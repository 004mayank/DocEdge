'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    processing: 'bg-amber-50 text-amber-700 border-amber-100',
    active: 'bg-blue-50 text-blue-700 border-blue-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
  };
  return map[status] ?? 'bg-gray-50 text-gray-600 border-gray-100';
}

export default function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const id = useMemo(() => params.id, [params.id]);
  const [c, setC] = useState<any>(null);
  const [soap, setSoap] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'soap' | 'transcript' | 'insights'>('soap');

  const refresh = useCallback(async () => {
    const res = await api.get(`/consultations/${id}`);
    setC(res.data);
    setSoap(res.data.soapNote ?? { subjective: '', objective: '', assessment: '', plan: '' });
  }, [id]);

  useEffect(() => {
    const t = loadToken();
    if (!t) { window.location.href = '/login'; return; }
    (async () => {
      try { await refresh(); } catch (e: any) {
        setError(e?.response?.data?.message ?? e.message ?? 'Failed');
      }
    })();

    const interval = window.setInterval(async () => {
      try {
        const s = await api.get(`/consultations/${id}/status`);
        if (s.data.status !== 'completed') return;
        await refresh();
        window.clearInterval(interval);
      } catch {}
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

  function formatTranscript() {
    const t = c?.normalizedTranscriptEn ?? c?.transcript;
    if (!t) return null;
    // Segments take priority — text field has embedded "Doctor:/Patient:" labels
    const segs = Array.isArray(t.segments) ? t.segments : [];
    if (segs.length > 0) {
      return segs.map((s: any) => {
        const speaker = typeof s.speaker === 'number'
          ? s.speaker
          : s.speaker === 'doctor' ? 0 : 1;
        return { speaker, text: s.text ?? '', t0: s.t0, t1: s.t1 };
      });
    }
    if (typeof t.text === 'string' && t.text.trim()) return [{ speaker: null, text: t.text }];
    return null;
  }

  const transcriptSegs = formatTranscript();
  const mrn = c?.patientId ? `MRN-${c.patientId.slice(0, 8).toUpperCase()}` : '';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4 shrink-0">
          <a
            href={c?.patientId ? `/patients/${c.patientId}` : '/patients'}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900">Consultation</h1>
              {c?.status && (
                <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium ${statusBadge(c.status)}`}>
                  {c.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-400 font-mono">{id.slice(0, 16)}…</span>
              {mrn && <span className="text-xs text-gray-400 font-mono">{mrn}</span>}
              {c?.startedAt && (
                <span className="text-xs text-gray-400">
                  {new Date(c.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {new Date(c.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {c?.status === 'processing' && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Processing…
            </div>
          )}
        </div>

        {error && (
          <div className="mx-8 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b border-gray-100 px-8 shrink-0">
          <div className="flex gap-0">
            {(['soap', 'transcript', 'insights'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'soap' ? 'SOAP Note' : tab === 'transcript' ? 'Transcript' : 'AI Insights'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto px-8 py-6">

          {/* SOAP tab */}
          {activeTab === 'soap' && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-500">
                  AI-generated note. Review and edit before saving.
                </p>
                <button
                  className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 transition-colors"
                  disabled={saving || !soap}
                  onClick={save}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Saving…
                    </>
                  ) : 'Save Note'}
                </button>
              </div>

              <div className="space-y-4">
                {(['subjective', 'objective', 'assessment', 'plan'] as const).map(k => (
                  <div key={k} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k}</span>
                    </div>
                    <textarea
                      className="w-full px-4 py-3 text-sm text-gray-800 min-h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-b-xl"
                      value={soap?.[k] ?? ''}
                      onChange={e => setSoap((s: any) => ({ ...(s ?? {}), [k]: e.target.value }))}
                      placeholder={`${k.charAt(0).toUpperCase() + k.slice(1)} notes…`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript tab */}
          {activeTab === 'transcript' && (
            <div className="max-w-2xl space-y-3">
              {!transcriptSegs ? (
                <div className="text-sm text-gray-400">
                  {c?.status === 'processing' ? 'Transcript will appear after processing…' : 'No transcript available.'}
                </div>
              ) : (
                transcriptSegs.map((seg: { speaker: number | null; text: string; t0?: number; t1?: number }, i: number) => (
                  <div key={i} className="space-y-0.5">
                    <div className={`text-xs font-semibold uppercase tracking-wider ${seg.speaker === 0 || seg.speaker === null ? 'text-blue-700' : 'text-gray-500'}`}>
                      {seg.speaker === null ? '' : seg.speaker === 0 ? 'Doctor' : 'Patient'}
                      {typeof seg.t0 === 'number' && (
                        <span className="ml-2 font-mono text-gray-300">[{seg.t0.toFixed(1)}s]</span>
                      )}
                    </div>
                    <div className={`inline-block max-w-[90%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      seg.speaker === 0 || seg.speaker === null
                        ? 'bg-white border border-gray-100 text-gray-800 shadow-sm'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {seg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Insights tab */}
          {activeTab === 'insights' && (
            <div className="max-w-2xl space-y-4">
              {!c?.aiInsights ? (
                <div className="text-sm text-gray-400">
                  {c?.status === 'processing' ? 'Insights generating…' : 'No insights available.'}
                </div>
              ) : (
                <>
                  {c.aiInsights.warnings?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Clinical Warnings</h3>
                      <div className="space-y-2">
                        {c.aiInsights.warnings.map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-800">
                            <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.aiInsights.actions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Suggested Actions</h3>
                      <div className="space-y-2">
                        {c.aiInsights.actions.map((a: any, i: number) => (
                          <div key={i} className="bg-white border border-gray-100 rounded-lg px-4 py-3 text-sm shadow-sm">
                            <div className="font-medium text-gray-800">{a.title}</div>
                            {a.why && <div className="text-gray-500 mt-0.5 text-xs">{a.why}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.aiInsights.entities?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Clinical Entities</h3>
                      <div className="flex flex-wrap gap-2">
                        {c.aiInsights.entities.map((e: any, i: number) => (
                          <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 text-xs font-medium">
                            {e.type && <span className="text-blue-400 mr-1">{e.type}</span>}
                            {e.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.aiInsights.inferredQna && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Doctor Questions (Inferred)</h3>
                      <div className="space-y-1">
                        {c.aiInsights.inferredQna.questions?.map((q: string, i: number) => (
                          <div key={i} className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{q}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
