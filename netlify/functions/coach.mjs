// KI-Coach: leitet Anfragen an Claude, ChatGPT oder Gemini weiter.
// Die API-Schlüssel liegen nur hier auf dem Server. Nur angemeldete Nutzer dürfen fragen, mit Tageslimit.
import { env, json, getUser, db } from './_lib.mjs';

const ALLOWED = {
  anthropic: [/^\/v1\/messages$/],
  openai: [/^\/v1\/chat\/completions$/, /^\/v1\/models$/],
  gemini: [/^\/v1beta\/models(\/[A-Za-z0-9.\-]+:generateContent)?$/]
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Nur POST erlaubt' }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: 'Bitte anmelden' }, 401);
  let p;
  try { p = await req.json(); } catch { return json({ error: 'Ungültige Anfrage' }, 400); }
  const { provider, method = 'POST' } = p;
  let path = String(p.path || '').split('?')[0];
  let body = p.body || null;
  if (!ALLOWED[provider] || !ALLOWED[provider].some((re) => re.test(path))) return json({ error: 'Nicht erlaubt' }, 400);

  // Tageslimit pro Nutzer (schützt vor hohen Kosten)
  const limit = parseInt(env('COACH_DAILY_LIMIT', '40'), 10);
  const day = new Date().toISOString().slice(0, 10);
  if (method === 'POST') {
    const rows = await db(`coach_usage?user_id=eq.${user.id}&day=eq.${day}&select=count`);
    const count = rows && rows[0] ? rows[0].count : 0;
    if (count >= limit) return json({ error: { message: `Tageslimit von ${limit} Coach-Anfragen erreicht. Morgen geht es weiter.` } }, 429);
    await db('coach_usage?on_conflict=user_id,day', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { user_id: user.id, day, count: count + 1 } });
  }

  let url, headers = { 'content-type': 'application/json' };
  if (provider === 'anthropic') {
    const key = env('ANTHROPIC_API_KEY'); if (!key) return json({ error: 'Claude ist nicht eingerichtet' }, 400);
    url = 'https://api.anthropic.com' + path;
    headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01';
    if (body) { body.model = env('ANTHROPIC_MODEL', body.model || 'claude-sonnet-5-5'); body.max_tokens = Math.min(body.max_tokens || 1200, 2000); }
  } else if (provider === 'openai') {
    const key = env('OPENAI_API_KEY'); if (!key) return json({ error: 'ChatGPT ist nicht eingerichtet' }, 400);
    url = 'https://api.openai.com' + path; headers.authorization = 'Bearer ' + key;
    if (body) body.model = env('OPENAI_MODEL', body.model || 'gpt-4o-mini');
  } else {
    const key = env('GEMINI_API_KEY'); if (!key) return json({ error: 'Gemini ist nicht eingerichtet' }, 400);
    if (env('GEMINI_MODEL')) path = path.replace(/models\/[^:]+:/, `models/${env('GEMINI_MODEL')}:`);
    url = 'https://generativelanguage.googleapis.com' + path + '?key=' + encodeURIComponent(key);
  }
  const r = await fetch(url, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
