// Löscht das Konto und alle Daten des angemeldeten Nutzers (DSGVO: Recht auf Löschung).
import { env, json, getUser, db, adminHeaders } from './_lib.mjs';
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: 'Bitte anmelden' }, 401);
  for (const t of ['user_state', 'icu_creds', 'coach_usage']) {
    try { await db(`${t}?user_id=eq.${user.id}`, { method: 'DELETE' }); } catch {}
  }
  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/admin/users/' + user.id, { method: 'DELETE', headers: adminHeaders() });
  if (!r.ok) return json({ error: 'Konto konnte nicht gelöscht werden' }, 500);
  return json({ ok: true });
};
