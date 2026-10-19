// Holt neue Aktivitäten von Strava (seit dem letzten Abgleich) und gibt sie im Format der Webseite zurück.
import { env, json, getUser, db } from './_lib.mjs';

function cat(s) {
  const n = String(s || '').toLowerCase();
  if (/swim/.test(n)) return 'swim';
  if (/run|trail|walk|hike/.test(n)) return /walk|hike/.test(n) ? 'other' : 'run';
  if (/ride|cycl|bike|velomobile|handcycle/.test(n)) return 'bike';
  if (/weight|workout|crossfit|yoga|pilates|hiit|strength/.test(n)) return 'gym';
  return 'other';
}

export default async (req) => {
  const user = await getUser(req);
  if (!user) return json({ error: 'Bitte anmelden' }, 401);
  const rows = await db(`strava_tokens?user_id=eq.${user.id}&select=*`);
  const tok = rows && rows[0];
  const url = new URL(req.url);
  if (url.searchParams.get('status')) return json({ connected: !!tok, athlete: tok ? tok.athlete_id : null, last: tok ? tok.last_sync : 0 });
  if (!tok) return json({ connected: false, activities: [] });

  let access = tok.access_token;
  if (tok.expires_at * 1000 < Date.now() + 60000) {
    const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env('STRAVA_CLIENT_ID'), client_secret: env('STRAVA_CLIENT_SECRET'), grant_type: 'refresh_token', refresh_token: tok.refresh_token }) });
    const t = await r.json();
    if (!r.ok || !t.access_token) return json({ error: 'Strava-Verbindung abgelaufen, bitte neu verbinden' }, 400);
    access = t.access_token;
    await db(`strava_tokens?user_id=eq.${user.id}`, { method: 'PATCH', body: { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at } });
  }
  // Beim ersten Abgleich die letzten 60 Tage holen, danach ab dem letzten Abgleich (mit 2 Tagen Überlappung)
  const after = tok.last_sync ? Math.floor(tok.last_sync / 1000) - 2 * 86400 : Math.floor(Date.now() / 1000) - 60 * 86400;
  const acts = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { authorization: 'Bearer ' + access } });
    if (r.status === 429) break;
    if (!r.ok) return json({ error: 'Strava: ' + r.status }, 502);
    const list = await r.json();
    for (const a of list) {
      const local = String(a.start_date_local || a.start_date).slice(0, 10);
      acts.push({ sid: a.id, t: a.start_date, day: local, cat: cat(a.sport_type || a.type), name: a.name, type: a.sport_type || a.type,
        dist: a.distance ? a.distance / 1000 : null, dur: a.moving_time || a.elapsed_time || null,
        hr: a.average_heartrate || null, pw: a.average_watts || null, hm: a.total_elevation_gain || null, src: 'strava' });
    }
    if (list.length < 100) break;
  }
  await db(`strava_tokens?user_id=eq.${user.id}`, { method: 'PATCH', body: { last_sync: Date.now() } });
  return json({ connected: true, activities: acts });
};
