'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = loadToken();
    if (!t) { window.location.href = '/login'; return; }
    (async () => {
      try {
        const res = await api.get('/patients');
        setPatients(res.data.items ?? []);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e.message ?? 'Failed');
      }
    })();
  }, []);

  async function createPatient() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.post('/patients', { fullName: newName.trim() });
      setPatients(p => [res.data, ...p]);
      setNewName('');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Failed');
    } finally {
      setCreating(false);
    }
  }

  const recentPatients = patients.slice(0, 5);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-xl px-5 py-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Total Patients</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{patients.length}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-5 py-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Start Consultation</div>
              <a href="/patients" className="mt-2 inline-flex items-center gap-1.5 text-blue-700 text-sm font-medium hover:text-blue-900">
                Choose patient →
              </a>
            </div>
            <div className="bg-blue-900 rounded-xl px-5 py-4">
              <div className="text-xs text-blue-300 uppercase tracking-wider font-medium">Quick Add Patient</div>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 bg-blue-800 text-white placeholder-blue-400 text-sm rounded-lg px-3 py-1.5 border border-blue-700 focus:outline-none focus:border-blue-400"
                  placeholder="Patient name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createPatient()}
                />
                <button
                  onClick={createPatient}
                  disabled={creating || !newName.trim()}
                  className="bg-white text-blue-900 text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-blue-50 transition-colors"
                >
                  {creating ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>

          {/* Recent patients */}
          <div className="bg-white border border-gray-100 rounded-xl">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Recent Patients</h2>
              <a href="/patients" className="text-xs text-blue-700 hover:text-blue-900 font-medium">View all →</a>
            </div>
            {recentPatients.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No patients yet. Add one above to get started.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentPatients.map(p => (
                  <a
                    key={p.id}
                    href={`/patients/${p.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs shrink-0">
                      {p.fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm group-hover:text-blue-900 transition-colors">{p.fullName}</div>
                      <div className="text-xs text-gray-400 font-mono">MRN-{p.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                    <a
                      href={`/patients/${p.id}/consult`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-700 hover:text-blue-900 font-medium border border-blue-100 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
                    >
                      Consult
                    </a>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
