// Löscht das Konto und alle Daten des angemeldeten Nutzers (DSGVO: Recht auf Löschung).
import { env, json, getUser, db, adminHeaders } from './_lib.mjs';
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: 'Bitte anmelden' }, 401);
  const rows = await db(`strava_tokens?user_id=eq.${user.id}&select=access_token`);
  if (rows && rows[0]) { try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: 'Bearer ' + rows[0].access_token } }); } catch {} }
  for (const t of ['user_state', 'strava_tokens', 'coach_usage']) await db(`${t}?user_id=eq.${user.id}`, { method: 'DELETE' });
  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/admin/users/' + user.id, { method: 'DELETE', headers: adminHeaders() });
  if (!r.ok) return json({ error: 'Konto konnte nicht gelöscht werden' }, 500);
  return json({ ok: true });
};
