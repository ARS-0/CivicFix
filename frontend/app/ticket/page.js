'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MapView from '@/components/MapView';
import { PriorityPill, StatusBadge, Stepper } from '@/components/Bits';
import { api, imgUrl } from '@/lib/api';
import { CATEGORIES } from '@/lib/constants';
import { useAuth } from '@/components/AuthProvider';

function Detail() {
  const id = useSearchParams().get('id');
  const { ready, notes } = useAuth();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (ready && id) api(`/reports/${id}`).then(setR).catch((e) => setErr(e.message)); }, [id, ready, notes.length]);

  if (err) return <p className="panel mx-auto max-w-md p-6 text-center">{err}</p>;
  if (!r) return <div className="skeleton h-96" />;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        {r.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgUrl(r.image_url)} alt={r.title} className="w-full rounded-lg border border-line object-cover" /> : <div className="panel grid h-56 place-items-center text-mute">No photo</div>}
        <MapView points={[r]} height={240} />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /><PriorityPill score={r.priority_score} /><span className="text-sm text-mute">Ticket #{r.id}</span></div>
        <h1 className="mt-3 text-3xl font-bold">{r.title}</h1>
        <p className="mt-1 text-mute">{CATEGORIES[r.category]}{r.department ? ` · ${r.department}` : ''}{r.duplicate_count > 0 ? ` · ${r.duplicate_count + 1} residents reported this` : ''}</p>
        {r.description && <p className="mt-4">{r.description}</p>}
        {r.ai_summary && <p className="mt-3 rounded bg-paper p-3 text-sm"><b>AI observations:</b> {r.ai_summary}</p>}
        <div className="panel mt-6 p-5"><Stepper status={r.status} /></div>
        <h2 className="mt-6 text-lg font-bold">History</h2>
        <ul className="mt-2 divide-y divide-line">
          {[...r.history].reverse().map((h, i) => (
            <li key={i} className="flex justify-between gap-3 py-2 text-sm"><span><b>{h.new_status}</b>{h.note ? ` — ${h.note}` : ''}</span><span className="shrink-0 text-mute">{new Date(h.timestamp).toLocaleString()}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense fallback={<div className="skeleton h-96" />}><Detail /></Suspense>; }
