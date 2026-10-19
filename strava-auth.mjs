// Strava verbinden (POST mit Code) oder trennen (DELETE). Tokens werden nur auf dem Server gespeichert.
import { env, json, getUser, db } from './_lib.mjs';
export default async (req) => {
  const user = await getUser(req);
  if (!user) return json({ error: 'Bitte anmelden' }, 401);
  if (req.method === 'DELETE') {
    const rows = await db(`strava_tokens?user_id=eq.${user.id}&select=access_token`);
    if (rows && rows[0]) { try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: 'Bearer ' + rows[0].access_token } }); } catch {} }
    await db(`strava_tokens?user_id=eq.${user.id}`, { method: 'DELETE' });
    return json({ ok: true });
  }
  if (req.method !== 'POST') return json({ error: 'Nur POST oder DELETE' }, 405);
  const { code } = await req.json();
  if (!code) return json({ error: 'Code fehlt' }, 400);
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env('STRAVA_CLIENT_ID'), client_secret: env('STRAVA_CLIENT_SECRET'), code, grant_type: 'authorization_code' })
  });
  const t = await r.json();
  if (!r.ok || !t.access_token) return json({ error: (t && t.message) || 'Strava hat die Anmeldung abgelehnt' }, 400);
  await db('strava_tokens?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: {
    user_id: user.id, athlete_id: t.athlete ? t.athlete.id : null, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, last_sync: 0 } });
  return json({ ok: true });
};
