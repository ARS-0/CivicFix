'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

function Form() {
  const { login, register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/report';
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', phone_number: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const u = mode === 'login' ? await login(f.email, f.password) : await register(f);
      router.push(u.role === 'admin' ? '/admin' : next);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <p className="mt-1 text-mute">{mode === 'login' ? 'Track your reports and get status updates.' : 'Free. Takes ten seconds.'}</p>
      <form onSubmit={submit} className="panel mt-6 space-y-4 p-5">
        {mode === 'register' && <div><label className="label" htmlFor="n">Full name</label><input id="n" className="field" required value={f.name} onChange={set('name')} autoComplete="name" /></div>}
        <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" className="field" required value={f.email} onChange={set('email')} autoComplete="email" /></div>
        <div><label className="label" htmlFor="p">Password</label><input id="p" type="password" minLength={8} className="field" required value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        {mode === 'register' && <div><label className="label" htmlFor="ph">WhatsApp number <span className="font-normal text-mute">(optional, with country code)</span></label><input id="ph" className="field" placeholder="+15551234567" value={f.phone_number} onChange={set('phone_number')} autoComplete="tel" /></div>}
        {err && <p role="alert" className="rounded bg-brick/10 px-3 py-2 text-sm text-brick">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-center text-sm">
        {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
        <button className="font-semibold text-road underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
      </p>
    </div>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
