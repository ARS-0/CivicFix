export const API = process.env.NEXT_PUBLIC_API_URL ?? '';
export const imgUrl = (p) => (!p ? null : p.startsWith('http') ? p : API + p);
export const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem('cf_token'));

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(API + '/api' + path, { method, headers, body: payload }); }
  catch { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
