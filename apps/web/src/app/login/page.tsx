'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { saveToken } from '@/lib/auth';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [clinicName, setClinicName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'login'
          ? await api.post('/auth/login', { email, password })
          : await api.post('/auth/register-doctor', {
              clinicName,
              email,
              password,
            });

      saveToken(res.data.token);
      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6">
        <h1 className="text-xl font-semibold">DocEdge</h1>
        <p className="text-sm text-gray-600 mt-1">Doctor access</p>

        <div className="mt-4 flex gap-2">
          <button
            className={`px-3 py-1.5 rounded border ${mode === 'login' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={`px-3 py-1.5 rounded border ${mode === 'register' ? 'bg-black text-white' : ''}`}
            onClick={() => setMode('register')}
          >
            Register clinic
          </button>
        </div>

        {mode === 'register' && (
          <div className="mt-4">
            <label className="text-sm">Clinic name</label>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="text-sm">Email</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label className="text-sm">Password</label>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

        <button
          disabled={busy}
          className="mt-6 w-full rounded bg-black text-white py-2 disabled:opacity-50"
          onClick={submit}
        >
          {busy ? 'Working…' : mode === 'login' ? 'Login' : 'Create & Login'}
        </button>
      </div>
    </main>
  );
}
