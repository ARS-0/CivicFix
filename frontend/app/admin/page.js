'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import MapView from '@/components/MapView';
import { PriorityPill, StatusBadge } from '@/components/Bits';
import { api, imgUrl } from '@/lib/api';
import { CATEGORIES, STATUSES, STATUS_COLOR, timeAgo } from '@/lib/constants';

const DEPTS = ['Roads & Highways', 'Street Lighting', 'Sanitation', 'Water & Sewerage', 'General Services'];

export default function Admin() {
  const { user, ready, socket } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('queue');
  useEffect(() => { if (ready && (!user || user.role !== 'admin')) router.replace('/auth?next=/admin'); }, [ready, user, router]);
  if (!ready || user?.role !== 'admin') return null;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">City dashboard</h1>
        <div className="flex rounded-md border border-line bg-white p-1" role="tablist">
          {[['queue', 'Queue and map'], ['analytics', 'Analytics']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-road text-white' : 'hover:bg-paper'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-6">{tab === 'queue' ? <Queue socket={socket} /> : <Analytics socket={socket} />}</div>
    </div>
  );
}

function Queue({ socket }) {
  const [rows, setRows] = useState([]);
  const [fs, setFs] = useState('');
  const [fc, setFc] = useState('');
  const [sel, setSel] = useState(null);
  const [live, setLive] = useState(false);

  const load = useCallback(() => {
    const q = new URLSearchParams(); if (fs) q.set('status', fs); if (fc) q.set('category', fc);
    api('/reports?' + q).then((d) => { setRows(d); setSel((s) => (s ? d.find((x) => x.id === s.id) || null : s)); }).catch(() => {});
  }, [fs, fc]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!socket) return;
    const h = () => { load(); setLive(true); setTimeout(() => setLive(false), 2500); };
    socket.on('report:new', h); socket.on('report:updated', h);
    return () => { socket.off('report:new', h); socket.off('report:updated', h); };
  }, [socket, load]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {STATUSES.map((s) => <button key={s} onClick={() => setFs(fs === s ? '' : s)} className={`rounded-md border px-3 py-1.5 text-sm ${fs === s ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}><b style={fs === s ? {} : { color: STATUS_COLOR[s] }}>{counts[s] ?? 0}</b> {s}</button>)}
        <select aria-label="Filter by category" className="field !w-auto" value={fc} onChange={(e) => setFc(e.target.value)}><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className={`ml-auto text-sm font-medium text-road transition-opacity ${live ? 'opacity-100' : 'opacity-0'}`} role="status">Updated live</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <MapView points={rows} onSelect={setSel} selectedId={sel?.id} height={620} />
        <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
          {sel && <Detail r={sel} onChanged={load} onClose={() => setSel(null)} />}
          {rows.length === 0 && <p className="panel p-6 text-center text-mute">No tickets match these filters.</p>}
          {rows.map((r) => (
            <button key={r.id} onClick={() => setSel(r)} className={`panel w-full p-3 text-left hover:bg-paper ${sel?.id === r.id ? 'ring-2 ring-signal' : ''}`}>
              <div className="flex items-start justify-between gap-2"><b className="leading-snug">{r.title}</b><PriorityPill score={r.priority_score} /></div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-mute"><StatusBadge status={r.status} /><span>{CATEGORIES[r.category]}</span><span>{timeAgo(r.created_at)}</span>{r.duplicate_count > 0 && <span className="font-semibold text-ink">+{r.duplicate_count} duplicate{r.duplicate_count > 1 ? 's' : ''}</span>}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Detail({ r, onChanged, onClose }) {
  const [note, setNote] = useState('');
  const [dept, setDept] = useState(r.department || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setNote(''); setDept(r.department || ''); setErr(''); }, [r.id]);
  async function move(status) {
    setBusy(true); setErr('');
    try { await api(`/reports/${r.id}/status`, { method: 'PATCH', body: { status, note, department: dept || undefined } }); setNote(''); onChanged(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="panel border-signal p-4 ring-2 ring-signal">
      <div className="flex justify-between gap-2"><Link href={`/ticket/?id=${r.id}`} className="text-lg font-bold underline-offset-2 hover:underline">#{r.id} {r.title}</Link><button onClick={onClose} className="text-mute" aria-label="Close details">✕</button></div>
      {r.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imgUrl(r.image_url)} alt="" className="mt-3 h-40 w-full rounded object-cover" />}
      <p className="mt-2 text-sm">{r.description}</p>
      <p className="mt-2 text-xs text-mute">Severity {r.severity_score}/10{r.near_public_zone ? ' · near public area' : ''}{r.ai_confidence != null ? ` · AI confidence ${Math.round(r.ai_confidence * 100)}%` : ''}</p>
      <label className="label mt-3" htmlFor="dept">Department</label>
      <select id="dept" className="field" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Unassigned</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select>
      <label className="label mt-3" htmlFor="note">Note to residents <span className="font-normal text-mute">(optional)</span></label>
      <input id="note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Crew scheduled for Tuesday" maxLength={200} />
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUSES.map((s) => <button key={s} disabled={busy || r.status === s} onClick={() => move(s)} className={`btn !px-3 !py-1.5 ${r.status === s ? 'btn-primary' : 'btn-ghost'}`}>{s}</button>)}
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-brick">{err}</p>}
    </div>
  );
}

function Bars({ data, label, value, fmt = (v) => v, color = '#14503C' }) {
  const max = Math.max(1, ...data.map((d) => d[value] || 0));
  if (!data.length) return <p className="text-sm text-mute">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d[label]} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-2 text-sm">
          <span className="truncate">{CATEGORIES[d[label]] || d[label]}</span>
          <span className="h-3 rounded bg-paper"><span className="block h-3 rounded" style={{ width: `${((d[value] || 0) / max) * 100}%`, background: color }} /></span>
          <b className="text-right">{fmt(d[value])}</b>
        </li>
      ))}
    </ul>
  );
}

function Analytics({ socket }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => api('/analytics').then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!socket) return; socket.on('report:new', load); socket.on('report:updated', load); return () => { socket.off('report:new', load); socket.off('report:updated', load); }; }, [socket, load]);
  if (!d) return <div className="skeleton h-96" />;

  const open = d.byStatus.filter((s) => s.status !== 'Resolved').reduce((a, b) => a + b.n, 0);
  const resolved = d.byStatus.find((s) => s.status === 'Resolved')?.n || 0;
  const dailyMax = Math.max(1, ...d.daily.map((x) => x.n));
  const hrs = (v) => (v == null ? '–' : v >= 48 ? `${(v / 24).toFixed(1)} d` : `${v} h`);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[['Open tickets', open], ['Resolved', resolved], ['Duplicates merged', d.totals.duplicates], ['Average priority', d.totals.avg_priority ?? '–']].map(([k, v]) => (
          <div key={k} className="panel p-4"><p className="font-display text-3xl font-extrabold">{v}</p><p className="text-sm text-mute">{k}</p></div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4"><h2 className="mb-3 text-lg font-bold">Problem hotspots</h2><MapView mode="heat" points={d.heat} height={340} /><p className="mt-2 text-xs text-mute">Open issues, weighted by AI priority score.</p></div>
        <div className="space-y-4">
          <div className="panel p-4"><h2 className="mb-3 text-lg font-bold">Reports by category</h2><Bars data={d.byCategory} label="category" value="n" /></div>
          <div className="panel p-4"><h2 className="mb-3 text-lg font-bold">Average time to resolve</h2><Bars data={d.resolution} label="category" value="hours" fmt={hrs} color="#1F5FA8" /></div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-3 text-lg font-bold">New reports, last 30 days</h2>
          <svg viewBox="0 0 300 80" className="w-full" role="img" aria-label="Daily new reports">
            {d.daily.map((x, i) => <rect key={x.day} x={i * 10 + 1} width="8" y={78 - (x.n / dailyMax) * 74} height={(x.n / dailyMax) * 74 + 0.5} rx="1.5" fill="#14503C"><title>{x.day}: {x.n}</title></rect>)}
          </svg>
        </div>
        <div className="panel overflow-x-auto p-4">
          <h2 className="mb-3 text-lg font-bold">Department performance</h2>
          <table className="w-full text-sm"><thead><tr className="text-left text-mute"><th className="pb-2 font-medium">Department</th><th className="pb-2 font-medium">Tickets</th><th className="pb-2 font-medium">Resolved</th><th className="pb-2 font-medium">Avg time</th></tr></thead>
            <tbody>{d.departments.map((x) => <tr key={x.department} className="border-t border-line"><td className="py-2">{x.department}</td><td>{x.total}</td><td>{x.resolved}</td><td>{hrs(x.avg_hours)}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
