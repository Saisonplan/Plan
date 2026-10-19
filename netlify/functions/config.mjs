// Öffentliche Konfiguration für die Webseite. Enthält KEINE geheimen Schlüssel.
import { env, json, anonKey, sbUrl } from './_lib.mjs';
export default async () => {
  // Coach über die Schlüssel dieser Seite nur, wenn COACH_SERVER=on gesetzt ist.
  const providers = [];
  if (env('COACH_SERVER') === 'on') {
    if (env('ANTHROPIC_API_KEY')) providers.push('anthropic');
    if (env('OPENAI_API_KEY')) providers.push('openai');
    if (env('GEMINI_API_KEY')) providers.push('gemini');
  }
  return json({
    supabaseUrl: sbUrl(),
    supabaseAnonKey: anonKey(),
    providers,
    models: { anthropic: env('ANTHROPIC_MODEL', 'claude-sonnet-5-5'), openai: env('OPENAI_MODEL', 'gpt-4o-mini'), gemini: env('GEMINI_MODEL', 'gemini-2.5-flash') }
  });
};
