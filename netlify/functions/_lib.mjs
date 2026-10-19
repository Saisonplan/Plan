// Gemeinsame Hilfsfunktionen für die Server-Funktionen (Netlify Functions)
export const env = (k, d = '') => process.env[k] || d;
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Prüft das Login-Token bei Supabase und gibt den Nutzer zurück (oder null)
export async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/user', { headers: { apikey: env('SUPABASE_ANON_KEY'), authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

// Header für den geheimen Schlüssel: neue Schlüssel (sb_secret_…) nur im apikey-Header,
// alte JWT-Schlüssel (service_role) zusätzlich als Bearer
export function adminHeaders() {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: 'Bearer ' + key };
}

// Datenbankzugriff mit dem Service-Schlüssel (nur auf dem Server, nie im Browser)
export async function db(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...adminHeaders(), 'content-type': 'application/json' };
  if (prefer) headers.prefer = prefer;
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error('Datenbank: ' + r.status + ' ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
