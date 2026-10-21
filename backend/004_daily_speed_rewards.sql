-- Ejecutar después de 003_daily_scoring.sql. Conserva saldos y partidas anteriores.
begin;
-- Reparar instalaciones que no recibieron las columnas de la migración 003.
alter table public.quiz_lqsa_stats
 add column if not exists daily_completed_date date,
 add column if not exists daily_last_score integer not null default 0;
-- Retirar la entrada antigua para evitar premios por la fórmula anterior.
drop function if exists public.quiz_lqsa_submit_daily(integer);
create or replace function public.quiz_lqsa_submit_daily(p_correct_remaining_ms integer[])
returns table(points_awarded integer, coins_awarded integer, total_points bigint, total_coins bigint, completed_date date)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_user uuid:=auth.uid();
 v_today date:=(clock_timestamp() at time zone 'Europe/Madrid')::date;
 v_points integer:=0; v_coins integer:=0; v_time integer;
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 if p_correct_remaining_ms is null or cardinality(p_correct_remaining_ms)>10 or coalesce(array_ndims(p_correct_remaining_ms),1)<>1 then raise exception 'invalid_daily_score'; end if;
 foreach v_time in array p_correct_remaining_ms loop
  if v_time is null or v_time<=0 or v_time>20000 then raise exception 'invalid_daily_time'; end if;
  v_points:=v_points+10+(v_time/1000)*2;
  v_coins:=v_coins+1+(v_time/5000);
 end loop;
 return query update public.quiz_lqsa_stats s
 set points=s.points+v_points,coins=s.coins+v_coins,
 daily_completed_date=v_today,daily_last_score=cardinality(p_correct_remaining_ms),updated_at=now()
 where s.user_id=v_user and (s.daily_completed_date is null or s.daily_completed_date<v_today)
 returning v_points,v_coins,s.points,s.coins,s.daily_completed_date;
 if not found then raise exception 'daily_already_completed_or_profile_missing'; end if;
end;
$$;
revoke all on function public.quiz_lqsa_submit_daily(integer[]) from public,anon;
grant execute on function public.quiz_lqsa_submit_daily(integer[]) to authenticated;
commit;
