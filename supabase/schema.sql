-- Saisonplan: Datenbank einrichten. In Supabase unter "SQL Editor" einfügen und auf "Run" klicken.

-- Gespeicherter Zustand pro Nutzer (Einrichtung, Häkchen, Kranktage, Aktivitäten ...)
create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at bigint not null,
  primary key (user_id, key)
);
alter table public.user_state enable row level security;
drop policy if exists "Nur eigene Daten" on public.user_state;
create policy "Nur eigene Daten" on public.user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- intervals.icu-Verbindung (Garmin, COROS ...): nur der Server (Service-Schlüssel) darf lesen und schreiben, deshalb keine Policy
create table if not exists public.icu_creds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id text not null,
  api_key text not null,
  last_sync bigint default 0
);
alter table public.icu_creds enable row level security;

-- Tageszähler für Coach-Anfragen (Kostenschutz), ebenfalls nur für den Server
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;

-- Alte Strava-Tabelle entfernen (falls vorhanden)
drop table if exists public.strava_tokens;
