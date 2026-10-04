'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { timeAgo } from '@/lib/constants';

export default function Navbar() {
  const { user, logout, notes, markRead } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = notes.filter((n) => !n.read).length;
  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-7 w-7 place-items-center rounded bg-signal text-ink" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
          </span>
          CivicFix
        </Link>
        <nav className="ml-4 hidden gap-5 text-sm font-medium sm:flex">
          <Link href="/report" className="hover:text-road">Report an issue</Link>
          {user && <Link href="/my" className="hover:text-road">My reports</Link>}
          {user?.role === 'admin' && <Link href="/admin" className="hover:text-road">Dashboard</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <div className="relative">
              <button onClick={() => { setOpen(!open); if (!open && unread) markRead(); }} className="btn btn-ghost relative !px-3" aria-label={`Notifications, ${unread} unread`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>
                {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brick px-1 text-[11px] font-bold text-white">{unread}</span>}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 max-h-96 w-80 overflow-auto rounded-lg border border-line bg-white shadow-xl">
                  {notes.length === 0 && <p className="p-4 text-sm text-mute">No updates yet. Status changes on your reports appear here.</p>}
                  {notes.map((n) => (
                    <Link key={n.id} href={n.report_id ? `/ticket/?id=${n.report_id}` : '/my'} onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm last:border-0 hover:bg-paper">
                      <p>{n.message}</p><p className="mt-1 text-xs text-mute">{timeAgo(n.created_at)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {user ? <button onClick={logout} className="btn btn-ghost">Sign out</button> : <Link href="/auth" className="btn btn-primary">Sign in</Link>}
        </div>
      </div>
      <nav className="flex gap-4 border-t border-line px-4 py-2 text-sm font-medium sm:hidden">
        <Link href="/report">Report</Link>{user && <Link href="/my">My reports</Link>}{user?.role === 'admin' && <Link href="/admin">Dashboard</Link>}
      </nav>
    </header>
  );
}
