-- Daily: anuncio intersticial y canje X2 de monedas tras el vídeo. Ejecutar en Supabase.
begin;
alter table public.quiz_lqsa_stats
 add column if not exists daily_completed_date date,
 add column if not exists daily_last_score integer not null default 0,
 add column if not exists daily_base_coins integer not null default 0,
 add column if not exists daily_coins_doubled boolean not null default false;
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
 daily_completed_date=v_today,daily_last_score=cardinality(p_correct_remaining_ms),daily_base_coins=v_coins,daily_coins_doubled=false,updated_at=now()
 where s.user_id=v_user and (s.daily_completed_date is null or s.daily_completed_date<v_today)
 returning v_points,v_coins,s.points,s.coins,s.daily_completed_date;
 if not found then raise exception 'daily_already_completed_or_profile_missing'; end if;
end;
$$;
revoke all on function public.quiz_lqsa_submit_daily(integer[]) from public,anon;
grant execute on function public.quiz_lqsa_submit_daily(integer[]) to authenticated;

create or replace function public.quiz_lqsa_double_daily_coins(p_date date) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();v_row public.quiz_lqsa_stats%rowtype;v_balance bigint;
begin
 if v_user is null then raise exception 'authentication_required';end if;
 select * into v_row from public.quiz_lqsa_stats where user_id=v_user for update;
 if not found or p_date is null or v_row.daily_completed_date is distinct from p_date then raise exception 'daily_reward_missing';end if;
 if v_row.daily_coins_doubled then return jsonb_build_object('status','already_claimed','coins',v_row.daily_base_coins*2);end if;
 if v_row.daily_base_coins<=0 then raise exception 'daily_no_coins';end if;
 update public.quiz_lqsa_stats set coins=coins+v_row.daily_base_coins,daily_coins_doubled=true,updated_at=now() where user_id=v_user returning coins into v_balance;
 return jsonb_build_object('status','claimed','coins',v_row.daily_base_coins*2,'balance',v_balance);
end;$$;
revoke all on function public.quiz_lqsa_double_daily_coins(date) from public,anon;
grant execute on function public.quiz_lqsa_double_daily_coins(date) to authenticated;
commit;
notify pgrst, 'reload schema';
