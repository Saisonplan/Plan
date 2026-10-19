// Öffentliche Konfiguration für die Webseite. Enthält KEINE geheimen Schlüssel.
import { env, json } from './_lib.mjs';
export default async () => {
  const providers = [];
  if (env('ANTHROPIC_API_KEY')) providers.push('anthropic');
  if (env('OPENAI_API_KEY')) providers.push('openai');
  if (env('GEMINI_API_KEY')) providers.push('gemini');
  return json({
    supabaseUrl: env('SUPABASE_URL'),
    supabaseAnonKey: env('SUPABASE_ANON_KEY'),
    providers,
    models: { anthropic: env('ANTHROPIC_MODEL', 'claude-sonnet-5-5'), openai: env('OPENAI_MODEL', 'gpt-4o-mini'), gemini: env('GEMINI_MODEL', 'gemini-2.5-flash') }
  });
};
