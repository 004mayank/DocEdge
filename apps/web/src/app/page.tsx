'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { clearToken, loadToken } from '@/lib/auth';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = loadToken();
    if (!t) window.location.href = '/login';
    setToken(t);
  }, []);

  async function createPatient() {
    setError(null);
    try {
      const res = await api.post('/patients', { fullName: name });
      setPatients((p) => [res.data, ...p]);
      setName('');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Failed');
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DocEdge</h1>
          <p className="text-sm text-gray-600">Doctor dashboard (MVP)</p>
        </div>
        <button
          className="border rounded px-3 py-1.5"
          onClick={() => {
            clearToken();
            window.location.href = '/login';
          }}
        >
          Logout
        </button>
      </header>

      <section className="mt-8 border rounded-xl p-4">
        <h2 className="font-semibold">Create patient</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="bg-black text-white rounded px-4" onClick={createPatient}>
            Add
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Patients</h2>
        <p className="text-sm text-gray-600">Temporary list (only newly created in this session)</p>
        <div className="mt-3 text-xs text-gray-500">Token loaded: {token ? 'yes' : 'no'}</div>
        <ul className="mt-4 space-y-2">
          {patients.map((p) => (
            <li key={p.id} className="border rounded p-3">
              <div className="font-medium">{p.fullName}</div>
              <div className="text-sm text-gray-600">{p.id}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
