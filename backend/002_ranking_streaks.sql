-- Quiz LQSA: perfiles públicos del ranking y racha diaria.
-- Ejecutar después de 001_stats.sql en el proyecto Supabase NUEVO de Quiz LQSA.
begin;

alter table public.quiz_lqsa_stats
  add column if not exists alias text,
  add column if not exists avatar_id text,
  add column if not exists streak_days integer not null default 0,
  add column if not exists last_active_date date;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_lqsa_stats_streak_nonnegative'
      and conrelid = 'public.quiz_lqsa_stats'::regclass
  ) then
    alter table public.quiz_lqsa_stats
      add constraint quiz_lqsa_stats_streak_nonnegative check (streak_days >= 0);
  end if;
end $$;

-- Users can change only their own alias/avatar. Points, coins, and streaks
-- remain protected from direct client updates.
grant update (alias, avatar_id) on public.quiz_lqsa_stats to authenticated;
drop policy if exists quiz_lqsa_own_profile_update on public.quiz_lqsa_stats;
create policy quiz_lqsa_own_profile_update
  on public.quiz_lqsa_stats for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.quiz_lqsa_save_profile(p_alias text, p_avatar_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if p_alias is null or char_length(btrim(p_alias)) not between 3 and 20 then
    raise exception 'invalid_alias_length';
  end if;
  if p_alias ~ '[[:cntrl:]]' then
    raise exception 'invalid_alias';
  end if;
  if p_avatar_id is null or p_avatar_id !~ '^avatar-([1-9]|1[0-9]|2[0-8])$' then
    raise exception 'invalid_avatar';
  end if;

  update public.quiz_lqsa_stats
     set alias = btrim(p_alias), avatar_id = p_avatar_id, updated_at = now()
   where user_id = v_user_id;
  if not found then
    insert into public.quiz_lqsa_stats(user_id, alias, avatar_id)
    values (v_user_id, btrim(p_alias), p_avatar_id);
  end if;
end;
$$;
revoke all on function public.quiz_lqsa_save_profile(text, text) from public, anon;
grant execute on function public.quiz_lqsa_save_profile(text, text) to authenticated;

-- The counter advances at most once per calendar day in Spain.
create or replace function public.quiz_lqsa_register_daily_visit()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
  v_streak integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  update public.quiz_lqsa_stats
     set streak_days = case
           when last_active_date = v_today then streak_days
           when last_active_date = v_today - 1 then streak_days + 1
           else 1
         end,
         last_active_date = v_today,
         updated_at = now()
   where user_id = v_user_id
   returning streak_days into v_streak;

  if v_streak is null then
    raise exception 'profile_not_found';
  end if;
  return v_streak;
end;
$$;
revoke all on function public.quiz_lqsa_register_daily_visit() from public, anon;
grant execute on function public.quiz_lqsa_register_daily_visit() to authenticated;

-- Expose only the public ranking fields, never user IDs, coins, or activity dates.
create or replace function public.quiz_lqsa_top_players()
returns table (
  "position" bigint,
  alias text,
  avatar_id text,
  points bigint,
  streak_days integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select row_number() over (order by s.points desc, lower(s.alias) asc) as "position",
         s.alias,
         s.avatar_id,
         s.points,
         s.streak_days
    from public.quiz_lqsa_stats as s
   where s.alias is not null and s.avatar_id is not null
   order by s.points desc, lower(s.alias) asc
   limit 20;
$$;
revoke all on function public.quiz_lqsa_top_players() from public;
grant execute on function public.quiz_lqsa_top_players() to anon, authenticated;

commit;
