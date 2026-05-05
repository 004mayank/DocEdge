'use client';

import { usePathname } from 'next/navigation';
import { clearToken } from '@/lib/auth';

function getDoctorEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    const token = window.localStorage.getItem('docedge_token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email ?? payload.sub ?? '';
  } catch {
    return '';
  }
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const NAV = [
  { label: 'Dashboard', href: '/', icon: DashboardIcon, match: (p: string) => p === '/' },
  { label: 'Consultations', href: '/patients', icon: ClipboardIcon, match: (p: string) => p.startsWith('/consultations') },
  { label: 'Patient List', href: '/patients', icon: UsersIcon, match: (p: string) => p.startsWith('/patients') },
  { label: 'Medical Records', href: '/patients', icon: FolderIcon, match: (_p: string) => false },
  { label: 'Analytics', href: '/', icon: ChartIcon, match: (_p: string) => false },
];

export function Sidebar() {
  const pathname = usePathname();
  const email = getDoctorEmail();
  const initials = email ? email.replace(/^dr[._]?/i, '')[0]?.toUpperCase() ?? 'D' : 'D';
  const namePart = email
    ? email.split('@')[0].replace(/^dr[._]?/i, '').replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
    : '';
  const displayName = namePart ? `Dr. ${namePart}` : 'Doctor';

  function isActive(match: (p: string) => boolean) {
    return match(pathname);
  }

  function logout() {
    clearToken();
    window.location.href = '/login';
  }

  return (
    <aside className="w-56 flex flex-col h-screen bg-white border-r border-gray-100 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-900 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">DocEdge</span>
        </div>
      </div>

      {/* Doctor profile */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-semibold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
            <div className="text-xs text-gray-500 truncate">General Practice</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item, i) => {
          const active = isActive(item.match);
          const Icon = item.icon;
          return (
            <a
              key={i}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={active ? 'text-white' : 'text-gray-400'}>
                <Icon />
              </span>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-2">
        <a
          href="/patients"
          className="flex items-center justify-center gap-2 w-full bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Consultation
        </a>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full text-gray-500 hover:text-gray-800 text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LogoutIcon />
          Logout
        </button>
      </div>
    </aside>
  );
}
