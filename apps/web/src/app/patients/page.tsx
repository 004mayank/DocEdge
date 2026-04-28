'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { loadToken } from '@/lib/auth';

export default function PatientsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = loadToken();
    if (!t) window.location.href = '/login';

    (async () => {
      try {
        const res = await api.get('/patients');
        setItems(res.data.items ?? []);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e.message ?? 'Failed');
      }
    })();
  }, []);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Patients</h1>
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <ul className="mt-6 space-y-2">
        {items.map((p) => (
          <li key={p.id} className="border rounded p-3">
            <a className="block" href={`/patients/${p.id}`}>
              <div className="font-medium">{p.fullName}</div>
              <div className="text-sm text-gray-600">{p.id}</div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
