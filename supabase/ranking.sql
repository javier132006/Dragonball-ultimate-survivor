-- =====================================================================
-- DRAGON BALL: ULTIMATE SURVIVOR · Cuentas y ranking mundial (Supabase)
-- Cómo usarlo: Supabase > tu proyecto > SQL Editor > New query,
-- pega TODO este archivo y pulsa "Run". Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- Perfiles: el nombre público de cada jugador ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 16 and name ~ '^[A-Za-z0-9_ ÁÉÍÓÚÜÑáéíóúüñ-]+$'),
  created_at timestamptz not null default now()
);
-- El nombre no se puede repetir (sin distinguir mayúsculas)
create unique index if not exists profiles_name_lower on public.profiles (lower(name));

alter table public.profiles enable row level security;
drop policy if exists "perfiles visibles" on public.profiles;
create policy "perfiles visibles" on public.profiles for select using (true);
drop policy if exists "editar mi perfil" on public.profiles;
create policy "editar mi perfil" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Al registrarse se crea su perfil con el nombre elegido en el juego
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Guerrero_' || substr(new.id::text, 1, 6)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Partidas ----------
-- La PUNTUACIÓN la calcula la base de datos a partir de las estadísticas
-- (misma fórmula que runScore en js/data.js), así nadie puede enviar un número inventado.
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ch text not null check (char_length(ch) between 1 and 16),
  kills integer not null check (kills >= 0),
  level integer not null check (level between 1 and 200),
  bosses integer not null check (bosses between 0 and 10),
  step integer not null check (step between 0 and 3),           -- mapa alcanzado (0..3)
  time integer not null check (time between 0 and 10800),       -- segundos (máximo 3 horas)
  win boolean not null default false,
  diff text not null check (diff in ('easy', 'normal', 'hard')),
  daily boolean not null default false,
  score integer generated always as (
    round(kills + level * 25 + bosses * 600 + step * 900 + time * 0.5 + case when win then 2500 else 0 end)::integer
  ) stored,
  created_at timestamptz not null default now(),
  -- Valores imposibles: más de 40 enemigos por segundo, o ganar sin llegar al mapa final
  constraint kills_posibles check (kills <= time * 40 + 100),
  constraint victoria_en_mapa_final check (not win or step = 3)
);
create index if not exists scores_score_idx on public.scores (score desc);
create index if not exists scores_user_idx on public.scores (user_id, score desc);
create index if not exists scores_daily_idx on public.scores (daily, created_at desc);

alter table public.scores enable row level security;
drop policy if exists "ranking publico" on public.scores;
create policy "ranking publico" on public.scores for select using (true);
drop policy if exists "subir mis partidas" on public.scores;
create policy "subir mis partidas" on public.scores for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Como mucho una partida cada 20 segundos por jugador (evita spam)
create or replace function public.scores_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.scores s where s.user_id = new.user_id and s.created_at > now() - interval '20 seconds') then
    raise exception 'Demasiadas partidas seguidas: espera unos segundos';
  end if;
  return new;
end;
$$;
drop trigger if exists scores_rate_limit on public.scores;
create trigger scores_rate_limit before insert on public.scores
  for each row execute function public.scores_rate_limit();

-- ---------- Ranking: la mejor partida de cada jugador ----------
create or replace view public.leaderboard with (security_invoker = true) as
select distinct on (s.user_id)
  s.user_id, p.name, s.score, s.ch, s.kills, s.level, s.step, s.time, s.win, s.diff, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.user_id, s.score desc, s.created_at asc;

-- ---------- Permisos ----------
-- Cualquiera puede LEER el ranking. Solo los usuarios con sesión pueden SUBIR partidas,
-- y solo estas columnas (no pueden elegir el usuario, la fecha ni la puntuación).
revoke all on public.profiles, public.scores from anon, authenticated;
grant select on public.profiles, public.scores, public.leaderboard to anon, authenticated;
grant update (name) on public.profiles to authenticated;
grant insert (ch, kills, level, bosses, step, time, win, diff, daily) on public.scores to authenticated;
grant usage on all sequences in schema public to authenticated;
