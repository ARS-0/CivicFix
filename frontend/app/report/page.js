'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import MapView from '@/components/MapView';
import { api } from '@/lib/api';
import { CATEGORIES, priorityTone } from '@/lib/constants';

export default function ReportPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [ai, setAi] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [f, setF] = useState({ title: '', description: '', category: '' });
  const [loc, setLoc] = useState(null);
  const [locNote, setLocNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => { if (ready && !user) router.replace('/auth?next=/report'); }, [ready, user, router]);

  async function locate(file) {
    try {
      const { default: exifr } = await import('exifr');
      const g = await exifr.gps(file);
      if (g?.latitude) { setLoc({ lat: g.latitude, lng: g.longitude }); setLocNote('Location read from the photo.'); return; }
    } catch {}
    if (navigator.geolocation) {
      setLocNote('Finding your location…');
      navigator.geolocation.getCurrentPosition(
        (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocNote('Using your current location.'); },
        () => setLocNote('We could not detect your location. Tap the map to place the pin.'),
        { enableHighAccuracy: true, timeout: 8000 });
    } else setLocNote('Tap the map to place the pin.');
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(''); setAi(null); setFile(file); setPreview(URL.createObjectURL(file)); setLoc(null);
    locate(file);
    setAnalyzing(true);
    try {
      const form = new FormData(); form.append('image', file);
      const r = await api('/reports/analyze', { method: 'POST', form });
      setAi(r);
      setF({ title: r.title || '', description: r.description || '', category: r.category || 'other' });
    } catch (x) { setErr(x.message); setF((p) => ({ ...p, category: p.category || 'other' })); }
    finally { setAnalyzing(false); }
  }

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!file) return setErr('Add a photo first.');
    if (!loc) return setErr('Tap the map to set where the problem is.');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', file);
      Object.entries(f).forEach(([k, v]) => form.append(k, v));
      form.append('lat', loc.lat); form.append('lng', loc.lng);
      if (ai) {
        form.append('severity', ai.severity); form.append('near_public_zone', ai.near_public_zone);
        form.append('ai_confidence', ai.confidence); form.append('ai_summary', (ai.details || []).join('; '));
      }
      setDone(await api('/reports', { method: 'POST', form }));
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  if (!ready || !user) return null;
  if (done) {
    const t = priorityTone(done.priority_score);
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-road text-2xl text-white">✓</div>
        <h1 className="mt-4 text-3xl font-bold">{done.merged_into ? 'Added to an existing ticket' : 'Report received'}</h1>
        <p className="mt-2 text-mute">
          {done.merged_into ? `Someone already reported this spot. Your photo was linked to ticket #${done.merged_into}, which raises its priority.` : `Ticket #${done.id} is in the queue as ${t.label.toLowerCase()} priority (score ${done.priority_score}).`} We will notify you when the status changes.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/ticket/?id=${done.id}`} className="btn btn-primary">View ticket</Link>
          <button className="btn btn-ghost" onClick={() => location.reload()}>Report another</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Report an issue</h1>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="sr-only" id="photo" />
        {!preview ? (
          <label htmlFor="photo" className="flex h-72 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-road/40 bg-white text-center hover:bg-paper">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-signal text-ink"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg></span>
            <b>Take or choose a photo</b><span className="text-sm text-mute">JPG, PNG or WebP, up to 10 MB</span>
          </label>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your photo of the problem" className="max-h-80 w-full object-cover" />
            <button type="button" onClick={() => inputRef.current.click()} className="btn btn-ghost absolute right-2 top-2 !py-1.5">Change photo</button>
          </div>
        )}
        {analyzing && (
          <div className="panel space-y-2 p-4" role="status"><p className="text-sm font-semibold">Analysing your photo…</p><div className="skeleton h-4 w-2/3" /><div className="skeleton h-4 w-full" /></div>
        )}
        {ai && !analyzing && ai.provider !== 'unavailable' && ai.provider !== 'fallback' && (
          <div className="panel flex flex-wrap items-center gap-x-5 gap-y-1 p-4 text-sm">
            <span><b>AI detected:</b> {CATEGORIES[ai.category]} ({Math.round(ai.confidence * 100)}% sure)</span>
            <span><b>Severity:</b> {ai.severity}/10</span>
            {ai.near_public_zone && <span className="font-semibold text-brick">Near a public area</span>}
            {ai.details?.length > 0 && <ul className="w-full list-disc pl-5 text-mute">{ai.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        )}
        {ai && (ai.provider === 'unavailable' || ai.provider === 'fallback') && <p className="rounded bg-signal/20 px-3 py-2 text-sm">Automatic analysis is off, so please choose the category and describe the problem yourself.</p>}
      </div>

      <div className="space-y-4">
        <div><label className="label" htmlFor="cat">Category</label>
          <select id="cat" className="field" required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="" disabled>Choose a category</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label className="label" htmlFor="t">Title</label><input id="t" className="field" required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Deep pothole in left lane" /></div>
        <div><label className="label" htmlFor="d">Description</label><textarea id="d" rows={4} className="field" maxLength={1500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What is wrong, and is anyone at risk?" /></div>
        <div>
          <span className="label">Location <span className="font-normal text-mute">(tap the map or drag the pin to adjust)</span></span>
          <MapView mode="pick" value={loc} onPick={setLoc} height={260} />
          {locNote && <p className="mt-1 text-sm text-mute">{locNote}</p>}
        </div>
        {err && <p role="alert" className="rounded bg-brick/10 px-3 py-2 text-sm text-brick">{err}</p>}
        <button className="btn btn-primary w-full !py-3" disabled={busy || analyzing}>{busy ? 'Submitting…' : 'Submit report'}</button>
      </div>
    </form>
  );
}
