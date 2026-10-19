// Gemeinsame Hilfsfunktionen für die Server-Funktionen (Netlify Functions)
export const env = (k, d = '') => (process.env[k] || d).trim();
// Beide Schreibweisen erlaubt (alter und neuer Name bei Supabase)
export const anonKey = () => env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY');
export const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
export const sbUrl = () => env('SUPABASE_URL').toLowerCase().replace(/[\/.\s]+$/, '');
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Prüft das Login-Token bei Supabase und gibt den Nutzer zurück (oder null)
export async function getUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(sbUrl() + '/auth/v1/user', { headers: { apikey: anonKey(), authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

// Header für den geheimen Schlüssel: neue Schlüssel (sb_secret_…) nur im apikey-Header,
// alte JWT-Schlüssel (service_role) zusätzlich als Bearer
export function adminHeaders() {
  const key = serviceKey();
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: 'Bearer ' + key };
}

// Datenbankzugriff mit dem Service-Schlüssel (nur auf dem Server, nie im Browser)
export async function db(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...adminHeaders(), 'content-type': 'application/json' };
  if (prefer) headers.prefer = prefer;
  const r = await fetch(sbUrl() + '/rest/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error('Datenbank: ' + r.status + ' ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
