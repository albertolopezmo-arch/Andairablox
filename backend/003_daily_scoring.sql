-- Daily: una entrega por usuario y día (hora de España), con puntos acreditados en servidor.
-- Ejecutar después de 001_stats.sql y 002_ranking_streaks.sql.
begin;

alter table public.quiz_lqsa_stats
  add column if not exists daily_completed_date date,
  add column if not exists daily_last_score integer not null default 0;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_lqsa_stats_daily_score_range'
      and conrelid = 'public.quiz_lqsa_stats'::regclass
  ) then
    alter table public.quiz_lqsa_stats
      add constraint quiz_lqsa_stats_daily_score_range
      check (daily_last_score between 0 and 10);
  end if;
end $$;

create or replace function public.quiz_lqsa_submit_daily(p_correct_answers integer)
returns table(points_awarded integer, total_points bigint, completed_date date)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if p_correct_answers is null or p_correct_answers not between 0 and 10 then
    raise exception 'invalid_daily_score';
  end if;

  return query
  update public.quiz_lqsa_stats as s
     set points = s.points + (p_correct_answers * 10),
         daily_completed_date = v_today,
         daily_last_score = p_correct_answers,
         updated_at = now()
   where s.user_id = v_user_id
     and (s.daily_completed_date is null or s.daily_completed_date < v_today)
  returning p_correct_answers * 10, s.points, s.daily_completed_date;

  if not found then
    raise exception 'daily_already_completed_or_profile_missing';
  end if;
end;
$$;

revoke all on function public.quiz_lqsa_submit_daily(integer) from public, anon;
grant execute on function public.quiz_lqsa_submit_daily(integer) to authenticated;

commit;
