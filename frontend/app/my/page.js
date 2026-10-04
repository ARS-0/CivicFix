'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Stepper } from '@/components/Bits';
import { api, imgUrl } from '@/lib/api';
import { CATEGORIES, timeAgo } from '@/lib/constants';

export default function My() {
  const { user, ready, notes } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const load = () => api('/reports').then(setRows).catch(() => setRows([]));
  useEffect(() => { if (ready && !user) router.replace('/auth?next=/my'); else if (user) load(); }, [ready, user, router]);
  useEffect(() => { if (notes.length) load(); }, [notes.length]); // live refresh when a status notification arrives

  if (!rows) return <div className="space-y-3"><div className="skeleton h-28" /><div className="skeleton h-28" /></div>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between"><h1 className="text-3xl font-bold">My reports</h1><Link href="/report" className="btn btn-signal">New report</Link></div>
      {rows.length === 0 && <div className="panel mt-6 p-8 text-center"><p className="font-semibold">You have not reported anything yet.</p><p className="mt-1 text-mute">Photograph a problem and it will show up here with live progress.</p><Link href="/report" className="btn btn-primary mt-4">Report an issue</Link></div>}
      <ul className="mt-6 space-y-4">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/ticket/?id=${r.id}`} className="panel block p-4 hover:bg-paper">
              <div className="flex gap-4">
                {r.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgUrl(r.image_url)} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{r.title}</p>
                  <p className="text-sm text-mute">#{r.id} · {CATEGORIES[r.category]} · {timeAgo(r.created_at)}{r.master_ticket_id ? ` · linked to #${r.master_ticket_id}` : ''}</p>
                </div>
              </div>
              <div className="mt-4"><Stepper status={r.master_status || r.status} /></div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
