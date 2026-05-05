'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    processing: 'bg-amber-50 text-amber-700 border-amber-100',
    active: 'bg-blue-50 text-blue-700 border-blue-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
  };
  return map[status] ?? 'bg-gray-50 text-gray-600 border-gray-100';
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'image') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const patientId = useMemo(() => params.id, [params.id]);
  const [patient, setPatient] = useState<any>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = loadToken();
    if (!t) { window.location.href = '/login'; return; }
    (async () => {
      try {
        const [p, cs, as] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/patients/${patientId}/consultations`),
          api.get(`/patients/${patientId}/artifacts`),
        ]);
        setPatient(p.data);
        setConsultations(cs.data.items ?? []);
        setArtifacts(as.data.items ?? []);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e.message ?? 'Failed');
      }
    })();
  }, [patientId]);

  async function downloadArtifact(artifactId: string) {
    const res = await api.get(`/uploads/artifacts/${artifactId}/presign-get`);
    const url = res.data?.presign?.url;
    if (url) window.open(url, '_blank');
  }

  async function onUploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const kind = file.type.startsWith('image/') ? 'image' : 'document';
      const pres = await api.post('/uploads/presign', {
        kind, patientId,
        contentType: file.type || 'application/octet-stream',
        originalName: file.name,
      });
      await fetch(pres.data.presign.url, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      await api.post('/uploads/register', {
        kind, patientId,
        objectKey: pres.data.object.key,
        contentType: file.type || 'application/octet-stream',
        originalName: file.name,
      });
      const as = await api.get(`/patients/${patientId}/artifacts`);
      setArtifacts(as.data.items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void onUploadFile(file);
  }

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const mrn = `MRN-${patientId.slice(0, 8).toUpperCase()}`;

  const docArtifacts = artifacts.filter(a => a.kind !== 'audio');

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        {/* Patient header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center gap-4">
            <a href="/patients" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
            {patient ? (
              <>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${COLORS[0]}`}>
                  {initials(patient.fullName ?? 'P')}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold text-gray-900">{patient.fullName}</h1>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 rounded px-2 py-0.5">{mrn}</span>
                    {patient.sex && (
                      <span className="text-xs text-gray-500 capitalize">{patient.sex}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {patient.phone ? patient.phone : 'No phone on record'}
                    {' · '}
                    <span className="font-mono text-xs">{patient.id}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
            )}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>
          )}

          {/* ─── Start Consultation CTA ─── */}
          <div className="bg-blue-900 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" opacity="0.8">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span className="text-blue-200 text-xs font-medium uppercase tracking-wider">Clinical Intelligence</span>
              </div>
              <h2 className="text-white text-lg font-semibold">Start New Consultation</h2>
              <p className="text-blue-300 text-sm mt-1">
                Record, transcribe in real time, and auto-generate SOAP notes
              </p>
            </div>
            <a
              href={`/patients/${patientId}/consult`}
              className="shrink-0 flex items-center gap-2 bg-white text-blue-900 font-semibold text-sm rounded-xl px-6 py-3 hover:bg-blue-50 transition-colors shadow"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
              </svg>
              Start Recording
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── Past Consultations ─── */}
            <div className="bg-white border border-gray-100 rounded-xl">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">Past Consultations</h2>
                <span className="text-xs text-gray-400">{consultations.length} total</span>
              </div>
              <div className="divide-y divide-gray-50">
                {consultations.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">No consultations yet</div>
                ) : (
                  consultations.slice(0, 6).map(c => (
                    <a key={c.id} href={`/consultations/${c.id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                      <div className="mt-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${statusBadge(c.status)}`}>
                            {c.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(c.endedAt ?? c.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {c.soapNote?.assessment && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{c.soapNote.assessment}</div>
                        )}
                      </div>
                      <svg className="text-gray-200 group-hover:text-gray-400 mt-0.5 shrink-0 transition-colors" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  ))
                )}
              </div>
            </div>

            {/* ─── Medical Records / Upload ─── */}
            <div className="bg-white border border-gray-100 rounded-xl">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">Medical Records</h2>
                <label className={`flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {uploading ? 'Uploading…' : 'Upload file'}
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*,.doc,.docx"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void onUploadFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Drop zone */}
              <div
                className={`mx-5 mt-4 mb-2 border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <svg className="mx-auto text-gray-300 mb-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
                <p className="text-xs text-gray-400">Drop PDF, image, or document here</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/*,.doc,.docx"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadFile(f);
                    e.currentTarget.value = '';
                  }}
                />
              </div>

              <div className="divide-y divide-gray-50 mb-2">
                {docArtifacts.length === 0 ? (
                  <div className="px-5 py-4 text-center text-xs text-gray-400">No records uploaded</div>
                ) : (
                  docArtifacts.slice(0, 6).map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className="text-gray-400 shrink-0">
                        <KindIcon kind={a.kind} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{a.originalName ?? a.objectKey}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <button
                        onClick={() => downloadArtifact(a.id)}
                        className="shrink-0 text-xs text-blue-700 hover:text-blue-900 font-medium transition-colors"
                      >
                        View
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
