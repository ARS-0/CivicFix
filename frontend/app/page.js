'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import MapView from '@/components/MapView';
import { StatusBadge } from '@/components/Bits';
import { api } from '@/lib/api';
import { CATEGORIES, STATUS_COLOR, STATUSES, timeAgo } from '@/lib/constants';

export default function Home() {
  const [pts, setPts] = useState([]);
  const [stats, setStats] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => { api('/reports/public').then(setPts).catch(() => {}); api('/stats').then(setStats).catch(() => {}); }, []);
  const resolved = pts.filter((p) => p.status === 'Resolved').slice(0, 4);

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">Spotted a problem on your street? Snap it.</h1>
          <p className="mt-5 max-w-md text-lg text-mute">Upload one photo. CivicFix identifies the issue, rates how urgent it is, pins it on the map and sends it to the right city team. You follow it until it is fixed.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/report" className="btn btn-signal !px-6 !py-3 text-base">Report an issue</Link>
            <a href="#map" className="btn btn-ghost !px-6 !py-3 text-base">See reports near you</a>
          </div>
          {stats && (
            <dl className="mt-8 flex gap-8">
              {[['Reports filed', stats.total], ['Fixed', stats.resolved], ['Duplicates merged', stats.duplicates_merged]].map(([k, v]) => (
                <div key={k}><dd className="font-display text-3xl font-extrabold">{v}</dd><dt className="text-sm text-mute">{k}</dt></div>
              ))}
            </dl>
          )}
        </div>
        <div id="map">
          <MapView points={pts} onSelect={setSel} selectedId={sel?.id} height={440} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
            {STATUSES.map((s) => <span key={s} className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{s}</span>)}
          </div>
          {sel && (
            <Link href={`/ticket/?id=${sel.id}`} className="panel mt-3 flex items-center justify-between gap-3 p-3 hover:bg-paper">
              <span><b>{sel.title}</b><br /><span className="text-sm text-mute">{CATEGORIES[sel.category]} · {timeAgo(sel.created_at)}</span></span>
              <StatusBadge status={sel.status} />
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">From photo to fixed</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-4">
          {[['Take a photo', 'Use your camera or pick one from your gallery. Location is read from the photo or your phone.'],
            ['AI sorts it', 'Vision AI names the issue, rates severity and drafts the title and description for you.'],
            ['Duplicates merge', 'If a neighbour already reported the same spot, your report joins that ticket and raises its priority.'],
            ['You get updates', 'Every status change reaches you live in the app, and on WhatsApp if you add your number.']].map(([t, d], i) => (
            <li key={t} className="panel p-5"><span className="grid h-7 w-7 place-items-center rounded-full bg-road text-sm font-bold text-white">{i + 1}</span><h3 className="mt-3 text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-mute">{d}</p></li>
          ))}
        </ol>
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold">Recently fixed</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {resolved.map((r) => (
              <li key={r.id}><Link href={`/ticket/?id=${r.id}`} className="panel flex items-center justify-between p-4 hover:bg-paper"><span><b>{r.title}</b><br /><span className="text-sm text-mute">{CATEGORIES[r.category]}</span></span><StatusBadge status={r.status} /></Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
