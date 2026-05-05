'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';

export default function PatientsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSex, setNewSex] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = loadToken();
    if (!t) { window.location.href = '/login'; return; }
    (async () => {
      try {
        const res = await api.get('/patients');
        setItems(res.data.items ?? []);
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
      const res = await api.post('/patients', {
        fullName: newName.trim(),
        phone: newPhone.trim() || undefined,
        sex: newSex || undefined,
      });
      setItems(prev => [res.data, ...prev]);
      setNewName(''); setNewPhone(''); setNewSex('');
      setShowNew(false);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Failed');
    } finally {
      setCreating(false);
    }
  }

  const filtered = items.filter(p =>
    p.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  function initials(name: string) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  const COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Patient List</h1>
            <p className="text-sm text-gray-500 mt-0.5">{items.length} patient{items.length !== 1 ? 's' : ''} total</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Patient
          </button>
        </div>

        <div className="px-8 py-6">
          {/* Search */}
          <div className="relative mb-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="w-full max-w-md pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="Search patients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</div>}

          {/* Add patient form */}
          {showNew && (
            <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="font-medium text-gray-900 mb-4">New Patient</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Name *</label>
                  <input
                    className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="e.g. Raj Kumar"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createPatient()}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</label>
                  <input
                    className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="+91 98765 43210"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sex</label>
                  <select
                    className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    value={newSex}
                    onChange={e => setNewSex(e.target.value)}
                  >
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  disabled={creating || !newName.trim()}
                  onClick={createPatient}
                  className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-lg px-5 py-2 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create Patient'}
                </button>
                <button
                  onClick={() => { setShowNew(false); setError(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Patient list */}
          {filtered.length === 0 && !error && (
            <div className="text-center py-16 text-gray-400">
              <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <p className="text-sm">{search ? 'No patients match your search' : 'No patients yet — add one above'}</p>
            </div>
          )}

          <div className="grid gap-3">
            {filtered.map((p, i) => (
              <a
                key={p.id}
                href={`/patients/${p.id}`}
                className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-5 py-4 hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${COLORS[i % COLORS.length]}`}>
                  {initials(p.fullName ?? 'P')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 group-hover:text-blue-900 transition-colors">{p.fullName}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">
                    MRN-{p.id.slice(0, 8).toUpperCase()}
                    {p.sex ? ` · ${p.sex}` : ''}
                    {p.phone ? ` · ${p.phone}` : ''}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <svg className="text-gray-300 group-hover:text-blue-400 transition-colors" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
