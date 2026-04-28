'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const patientId = useMemo(() => params.id, [params.id]);
  const [patient, setPatient] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = loadToken();
    if (!t) window.location.href = '/login';

    (async () => {
      try {
        const [p, tl, cs, as] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/patients/${patientId}/timeline`),
          api.get(`/patients/${patientId}/consultations`),
          api.get(`/patients/${patientId}/artifacts`),
        ]);

        setPatient(p.data);
        setTimeline(tl.data.items ?? []);
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

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <a className="text-sm underline" href="/patients">
            ← Back
          </a>
          <h1 className="text-2xl font-semibold mt-2">
            {patient?.fullName ?? 'Patient'}
          </h1>
          {patient && (
            <div className="text-sm text-gray-600 mt-1">
              {patient.sex ? `Sex: ${patient.sex}` : ''}{patient.phone ? ` • Phone: ${patient.phone}` : ''}
            </div>
          )}
        </div>
      </div>

      {error && <div className="mt-6 text-sm text-red-600">{error}</div>}

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold">Timeline</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {timeline.map((e) => (
              <li key={e.id} className="border rounded p-2">
                <div className="font-medium">{e.type}</div>
                <div className="text-xs text-gray-600">{e.createdAt}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold">Consultations</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {consultations.map((c) => (
              <li key={c.id} className="border rounded p-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.status}</div>
                  <div className="text-xs text-gray-600">{c.endedAt ?? c.startedAt}</div>
                </div>
                {c.soapNote?.assessment && (
                  <div className="text-xs text-gray-700 mt-1 line-clamp-2">
                    {c.soapNote.assessment}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Artifacts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {artifacts.map((a) => (
            <li key={a.id} className="border rounded p-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{a.originalName ?? a.objectKey}</div>
                <div className="text-xs text-gray-600">{a.kind} • {a.createdAt}</div>
              </div>
              <button className="border rounded px-3 py-1" onClick={() => downloadArtifact(a.id)}>
                Download
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
