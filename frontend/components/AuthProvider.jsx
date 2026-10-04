'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API, api, getToken } from '@/lib/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState([]);
  const [toast, setToast] = useState(null);
  const [socket, setSocket] = useState(null);
  const sockRef = useRef(null);

  const connect = useCallback((token) => {
    sockRef.current?.disconnect();
    const s = io(API || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('notification', (n) => {
      setNotes((l) => [n, ...l]);
      setToast(n.message);
      setTimeout(() => setToast(null), 6000);
    });
    sockRef.current = s;
    setSocket(s);
  }, []);

  const loadNotes = () => api('/notifications').then(setNotes).catch(() => {});

  useEffect(() => {
    const t = getToken();
    if (!t) { setReady(true); return; }
    api('/auth/me').then(({ user }) => { setUser(user); connect(t); loadNotes(); })
      .catch(() => localStorage.removeItem('cf_token')).finally(() => setReady(true));
    return () => sockRef.current?.disconnect();
  }, [connect]);

  const finish = ({ token, user }) => { localStorage.setItem('cf_token', token); setUser(user); connect(token); loadNotes(); return user; };
  const login = async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const register = async (b) => finish(await api('/auth/register', { method: 'POST', body: b }));
  const logout = () => { localStorage.removeItem('cf_token'); sockRef.current?.disconnect(); setSocket(null); setUser(null); setNotes([]); };
  const markRead = async () => { await api('/notifications/read', { method: 'POST' }); setNotes((l) => l.map((n) => ({ ...n, read: true }))); };

  return (
    <Ctx.Provider value={{ user, ready, login, register, logout, notes, markRead, socket }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[2000] w-full max-w-md -translate-x-1/2 px-4">
        {toast && <div className="pointer-events-auto rounded-md bg-ink px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
      </div>
    </Ctx.Provider>
  );
}
