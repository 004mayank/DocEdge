'use client';

import { useEffect, useState } from 'react';
import { loadToken } from '@/lib/auth';

function WaveformIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0c.95 0 1.84.4 2.47 1.06A3.5 3.5 0 0 1 20 6.5c0 .95-.38 1.82-.98 2.46A3 3 0 0 1 20 12a3 3 0 0 1-2.5 2.96V16a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-1.04A3 3 0 0 1 4 12a3 3 0 0 1 .98-2.54A3.5 3.5 0 0 1 4 6.5a3.5 3.5 0 0 1 3.03-3.44A2.5 2.5 0 0 1 9.5 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: MicIcon,
    color: 'bg-blue-50 text-blue-700',
    title: 'Realtime Transcription',
    desc: 'Every word captured instantly via Deepgram nova-2. No post-session uploads — the transcript is ready the moment you stop speaking.',
  },
  {
    icon: BrainIcon,
    color: 'bg-violet-50 text-violet-700',
    title: 'AI-Generated SOAP Notes',
    desc: 'GPT converts your consultation transcript into a structured SOAP note — Subjective, Objective, Assessment, Plan — in seconds.',
  },
  {
    icon: WaveformIcon,
    color: 'bg-emerald-50 text-emerald-700',
    title: 'Speaker Diarization',
    desc: 'Automatically identifies who said what. Doctor and patient speech are separated and labelled using AI context analysis.',
  },
  {
    icon: ClockIcon,
    color: 'bg-amber-50 text-amber-700',
    title: 'Save Hours Daily',
    desc: 'Doctors spend 2+ hours per day on documentation. DocEdge brings that to minutes — giving you more time for patients.',
  },
  {
    icon: ShieldIcon,
    color: 'bg-rose-50 text-rose-700',
    title: 'Clinic-Level Security',
    desc: 'Every consultation is isolated to your clinic. JWT-based auth, encrypted storage, and no data shared across accounts.',
  },
  {
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: 'bg-sky-50 text-sky-700',
    title: 'Patient Records',
    desc: 'All consultations, notes, and artifacts stored per patient. Full timeline with easy access to past sessions and diagnoses.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Open a consultation',
    desc: 'Select a patient and click Start Consultation. DocEdge connects to your microphone and opens a realtime transcript.',
  },
  {
    num: '02',
    title: 'Conduct your consultation',
    desc: 'Speak naturally. The transcript populates in realtime — speaker-separated, with live symptom detection in the sidebar.',
  },
  {
    num: '03',
    title: 'Get your SOAP note',
    desc: "Click Stop. AI analyses the conversation and generates a full SOAP note within seconds. Review, export, or file it.",
  },
];

const TESTIMONIALS = [
  {
    quote: "Documentation that used to take 30 minutes now takes 30 seconds. DocEdge has completely changed how I close my day.",
    name: 'Dr. Priya Nair',
    role: 'General Physician, Mumbai',
    initials: 'PN',
  },
  {
    quote: 'The speaker diarization is surprisingly accurate. It correctly separates my questions from patient responses even in noisy clinics.',
    name: 'Dr. Arjun Mehta',
    role: 'Internist, Bangalore',
    initials: 'AM',
  },
  {
    quote: 'I was skeptical about AI-generated notes, but the SOAP quality is clinical-grade. Always a good starting point for my records.',
    name: 'Dr. Sunita Rao',
    role: 'Paediatrician, Delhi',
    initials: 'SR',
  },
];

export default function HomePage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (loadToken()) setAuthed(true);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-base tracking-tight">DocEdge</span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#testimonials" className="hover:text-gray-900 transition-colors">Testimonials</a>
          </nav>

          <div className="flex items-center gap-3">
            {authed ? (
              <a
                href="/dashboard"
                className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                Open Dashboard <ArrowRightIcon />
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Log in
                </a>
                <a
                  href="/login"
                  className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Get started <ArrowRightIcon />
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-slate-950 via-blue-950 to-blue-900 text-white relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        {/* Glow blobs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-800/50 border border-blue-700/50 rounded-full px-4 py-1.5 text-xs text-blue-200 font-medium mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Powered by Deepgram nova-2 &amp; GPT-4
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            Clinical documentation,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-violet-300">
              done in seconds.
            </span>
          </h1>

          <p className="mt-6 text-lg text-blue-100/80 max-w-2xl mx-auto leading-relaxed">
            DocEdge listens to your consultation in realtime, separates doctor and patient speech,
            and generates a complete SOAP note the moment you stop speaking.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-900 font-semibold rounded-xl px-8 py-3.5 hover:bg-blue-50 transition-colors text-sm shadow-lg shadow-blue-950/30"
            >
              Start for free <ArrowRightIcon />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 bg-blue-800/50 border border-blue-700/50 text-white font-medium rounded-xl px-8 py-3.5 hover:bg-blue-800 transition-colors text-sm backdrop-blur-sm"
            >
              See how it works
            </a>
          </div>

          {/* Stat pills */}
          <div className="mt-16 flex flex-wrap gap-4 justify-center">
            {[
              { label: 'Time saved per day', value: '2+ hrs' },
              { label: 'Transcription accuracy', value: '98%' },
              { label: 'Note generation time', value: '< 30s' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-blue-200/70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock consultation card */}
        <div className="relative max-w-3xl mx-auto mt-16">
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-slate-950/50">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-slate-400 font-mono">docedge · live consultation</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Recording
              </span>
            </div>

            {/* Transcript lines */}
            <div className="p-5 space-y-3 text-sm font-mono">
              {[
                { speaker: 'Doctor', color: 'text-blue-300', text: 'Good morning. What brings you in today?' },
                { speaker: 'Patient', color: 'text-violet-300', text: 'I\'ve had a throbbing headache for about three days now, mostly on the left side.' },
                { speaker: 'Doctor', color: 'text-blue-300', text: 'Any nausea, vomiting, or sensitivity to light?' },
                { speaker: 'Patient', color: 'text-violet-300', text: 'Yes, light makes it much worse. And some nausea in the morning.' },
                { speaker: 'Doctor', color: 'text-blue-300', text: 'This sounds consistent with a migraine presentation. Let me check your BP first.' },
              ].map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className={`shrink-0 font-semibold ${line.color} w-14`}>{line.speaker}</span>
                  <span className="text-slate-300">{line.text}</span>
                </div>
              ))}
              {/* Typing cursor */}
              <div className="flex gap-3 items-center">
                <span className="shrink-0 w-14 text-slate-600">···</span>
                <span className="w-2 h-4 bg-blue-400/70 rounded-sm animate-pulse" />
              </div>
            </div>

            {/* SOAP preview strip */}
            <div className="border-t border-white/10 bg-slate-950/50 px-5 py-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-3">SOAP note — generating</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'S', title: 'Subjective', text: 'Throbbing left-sided headache ×3 days, photophobia, morning nausea…' },
                  { label: 'O', title: 'Objective', text: 'BP check pending. No focal neuro deficit noted on history.' },
                  { label: 'A', title: 'Assessment', text: 'Consistent with migraine (ICD G43.9). Rule out secondary causes.' },
                  { label: 'P', title: 'Plan', text: 'Sumatriptan 50mg PRN. Avoid triggers. Review in 2 weeks.' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-4 h-4 rounded bg-blue-600/60 flex items-center justify-center text-blue-200 font-bold text-xs">{s.label}</span>
                      <span className="text-slate-400 font-medium">{s.title}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-blue-700 uppercase tracking-widest mb-4">Features</div>
            <h2 className="text-4xl font-bold text-gray-900">Everything a busy doctor needs</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">Built specifically for clinical workflows. No bloat, no complicated setup.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md hover:border-gray-200 transition-all group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color} mb-4`}>
                    <Icon />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-blue-700 uppercase tracking-widest mb-4">Workflow</div>
            <h2 className="text-4xl font-bold text-gray-900">From consultation to note in 3 steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(100%-0px)] w-full h-px bg-gradient-to-r from-blue-200 to-transparent z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center text-xl font-bold mb-5 shadow-lg shadow-blue-900/20">
                    {step.num}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOAP preview deep-dive ─────────────────────────────────── */}
      <section className="py-24 px-6 bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-widest mb-4">AI Documentation</div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
              Clinical-grade SOAP notes,<br />
              <span className="text-blue-300">generated automatically.</span>
            </h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              DocEdge uses GPT-4 trained on clinical context to produce notes that read like they were written by the doctor —
              because they are. The AI structures your words, not invents them.
            </p>
            <ul className="space-y-3">
              {[
                'Doctor & patient speech correctly attributed',
                'Medications, diagnoses, and vitals extracted',
                'Assistive warnings always included',
                'Supports English, Hindi, and Hinglish',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="/login"
              className="mt-10 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl px-6 py-3 transition-colors text-sm"
            >
              Try it now <ArrowRightIcon />
            </a>
          </div>

          {/* SOAP card */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 bg-slate-950/80 flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-200">SOAP Note</span>
              <span className="ml-auto text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">AI-generated</span>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {[
                { letter: 'S', color: 'bg-blue-600', label: 'Subjective', text: 'Patient presents with a 3-day history of left-sided throbbing headache. Reports associated photophobia and morning nausea. No vomiting. No prior similar episodes reported in today\'s visit.' },
                { letter: 'O', color: 'bg-violet-600', label: 'Objective', text: 'Blood pressure assessment pending. No focal neurological deficits elicited on history. Patient alert and oriented.' },
                { letter: 'A', color: 'bg-amber-600', label: 'Assessment', text: 'Clinical presentation consistent with migraine without aura (ICD-10: G43.9). Secondary causes to be excluded if no improvement.' },
                { letter: 'P', color: 'bg-emerald-600', label: 'Plan', text: 'Prescribe Sumatriptan 50mg PRN for acute attacks. Advise trigger diary. Avoid bright screens. Follow-up in 2 weeks or sooner if worsening.' },
              ].map(s => (
                <div key={s.letter} className="flex gap-3">
                  <span className={`w-5 h-5 rounded flex items-center justify-center ${s.color} text-white font-bold text-xs shrink-0 mt-0.5`}>{s.letter}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</div>
                    <p className="text-slate-300 leading-relaxed">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-white/10 bg-slate-950/50 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-xs text-slate-500">Assistive output only — doctor must verify before filing</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <section id="testimonials" className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-blue-700 uppercase tracking-widest mb-4">Testimonials</div>
            <h2 className="text-4xl font-bold text-gray-900">Doctors love it</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-blue-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Ready to reclaim your<br />
            <span className="text-blue-200">time as a doctor?</span>
          </h2>
          <p className="text-blue-200/80 text-lg mb-10 max-w-xl mx-auto">
            Register your clinic in under a minute. No credit card required.
            Start your first AI-assisted consultation today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-900 font-semibold rounded-xl px-8 py-3.5 hover:bg-blue-50 transition-colors text-sm shadow-lg shadow-blue-950/30"
            >
              Create free account <ArrowRightIcon />
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 border border-blue-700 text-white font-medium rounded-xl px-8 py-3.5 hover:bg-blue-800 transition-colors text-sm"
            >
              Log in to existing clinic
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 bg-slate-950 text-slate-500 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-900 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="font-semibold text-slate-300">DocEdge</span>
          </div>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} DocEdge. AI-assisted clinical documentation. Always verify before filing.</p>
          <div className="flex items-center gap-6 text-xs">
            <a href="/login" className="hover:text-slate-300 transition-colors">Login</a>
            <a href="/login" className="hover:text-slate-300 transition-colors">Register clinic</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
