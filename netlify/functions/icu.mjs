// intervals.icu: Verbindung speichern und Aktivitäten abholen.
// Garmin, COROS, Wahoo, Polar und Suunto synchronisieren direkt mit intervals.icu (kostenlos).
// Die Zugangsdaten liegen nur in der Datenbank (Tabelle icu_creds) und sind nur für den Server lesbar.
import { json, getUser, db } from './_lib.mjs';

const API = 'https://intervals.icu/api/v1';
const auth = (key) => ({ authorization: 'Basic ' + Buffer.from('API_KEY:' + key).toString('base64'), accept: 'application/json' });
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

function cat(s) {
  const n = String(s || '').toLowerCase();
  if (/swim/.test(n)) return 'swim';
  if (/walk|hike/.test(n)) return 'other';
  if (/run/.test(n)) return 'run';
  if (/ride|cycl|bike|velomobile|handcycle/.test(n)) return 'bike';
  if (/weight|workout|crossfit|yoga|pilates|hiit|strength/.test(n)) return 'gym';
  return 'other';
}

export default async (req) => {
  const user = await getUser(req);
  if (!user) return json({ error: 'Bitte anmelden' }, 401);
  const url = new URL(req.url);

  // Verbinden: Athleten-ID und API-Schlüssel prüfen und speichern
  if (req.method === 'POST') {
    let b = {};
    try { b = await req.json(); } catch {}
    const id = String(b.athlete_id || '').trim().replace(/^i?(\d+)$/i, 'i$1');
    const key = String(b.api_key || '').trim();
    if (!/^i\d+$/.test(id) || key.length < 10) return json({ error: 'Bitte Athleten-ID (z. B. i123456) und API-Schlüssel eintragen.' }, 400);
    const r = await fetch(`${API}/athlete/${id}`, { headers: auth(key) });
    if (r.status === 401 || r.status === 403) return json({ error: 'intervals.icu lehnt die Daten ab. Bitte ID und Schlüssel prüfen.' }, 400);
    if (!r.ok) return json({ error: 'intervals.icu antwortet nicht (' + r.status + ').' }, 502);
    const a = await r.json().catch(() => ({}));
    await db('icu_creds?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { user_id: user.id, athlete_id: id, api_key: key, last_sync: 0 } });
    return json({ ok: true, name: a.name || null });
  }

  // Trennen
  if (req.method === 'DELETE') {
    await db(`icu_creds?user_id=eq.${user.id}`, { method: 'DELETE' });
    return json({ ok: true });
  }

  const rows = await db(`icu_creds?user_id=eq.${user.id}&select=*`);
  const c = rows && rows[0];
  if (url.searchParams.get('status')) return json({ connected: !!c, athlete: c ? c.athlete_id : null, last: c ? c.last_sync : 0 });
  if (!c) return json({ connected: false, activities: [] });

  // Erster Abgleich: letzte 60 Tage, danach ab dem letzten Abgleich mit 2 Tagen Überlappung
  const from = c.last_sync ? c.last_sync - 2 * 86400000 : Date.now() - 60 * 86400000;
  const r = await fetch(`${API}/athlete/${c.athlete_id}/activities?oldest=${day(from)}&newest=${day(Date.now() + 86400000)}`, { headers: auth(c.api_key) });
  if (r.status === 401 || r.status === 403) return json({ error: 'intervals.icu-Zugang ungültig, bitte neu verbinden.' }, 400);
  if (!r.ok) return json({ error: 'intervals.icu: ' + r.status }, 502);
  const list = await r.json();
  const acts = [];
  for (const a of Array.isArray(list) ? list : []) {
    // Von Strava übernommene Einträge liefert intervals.icu ohne Details: überspringen
    if (!a || !a.type || String(a.source || '').toUpperCase() === 'STRAVA') continue;
    const local = String(a.start_date_local || a.start_date || '');
    acts.push({
      sid: 'icu' + a.id, t: a.start_date || local, day: local.slice(0, 10), cat: cat(a.type), name: a.name || a.type, type: a.type,
      dist: a.distance ? a.distance / 1000 : null, dur: a.moving_time || a.elapsed_time || null,
      hr: a.average_heartrate || null, pw: a.icu_average_watts || a.average_watts || null, hm: a.total_elevation_gain || null, src: 'icu'
    });
  }
  await db(`icu_creds?user_id=eq.${user.id}`, { method: 'PATCH', body: { last_sync: Date.now() } });
  return json({ connected: true, activities: acts });
};
