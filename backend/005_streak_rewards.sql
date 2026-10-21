begin;
alter table public.quiz_lqsa_stats add column if not exists reward_cycle text not null default 'initial';
create table if not exists public.quiz_lqsa_streak_rewards(
 user_id uuid not null references auth.users(id) on delete cascade,
 cycle_id text not null,
 milestone integer not null check(milestone in(5,10,15,20,25,30)),
 coins integer not null check(coins>0),
 claimed_at timestamptz not null default now(),
 primary key(user_id,cycle_id,milestone)
);
alter table public.quiz_lqsa_streak_rewards enable row level security;
revoke all on public.quiz_lqsa_streak_rewards from anon,authenticated;
grant select on public.quiz_lqsa_streak_rewards to authenticated;
drop policy if exists own_streak_rewards on public.quiz_lqsa_streak_rewards;
create policy own_streak_rewards on public.quiz_lqsa_streak_rewards for select to authenticated using(user_id=auth.uid());
create or replace function public.quiz_lqsa_register_daily_visit() returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();v_today date:=(clock_timestamp() at time zone 'Europe/Madrid')::date;v_row public.quiz_lqsa_stats%rowtype;v_streak integer;
begin
 if v_user is null then raise exception 'authentication_required';end if;
 select * into v_row from public.quiz_lqsa_stats where user_id=v_user for update;
 if not found then raise exception 'profile_not_found';end if;
 if v_row.last_active_date=v_today then return v_row.streak_days;end if;
 v_streak:=case when v_row.last_active_date=v_today-1 then v_row.streak_days+1 else 1 end;
 update public.quiz_lqsa_stats set streak_days=v_streak,last_active_date=v_today,updated_at=now(),
 reward_cycle=case when v_streak=1 or (v_streak-1)/30<>greatest(v_row.streak_days-1,0)/30 then gen_random_uuid()::text else reward_cycle end where user_id=v_user;
 return v_streak;
end;$$;
revoke all on function public.quiz_lqsa_register_daily_visit() from public,anon;
grant execute on function public.quiz_lqsa_register_daily_visit() to authenticated;
create or replace function public.quiz_lqsa_claim_streak(p_milestone integer,p_cycle text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();v_row public.quiz_lqsa_stats%rowtype;v_coins integer;v_balance bigint;
begin
 if v_user is null then raise exception 'authentication_required';end if;
 if p_milestone is null or p_milestone not in(5,10,15,20,25,30) then raise exception 'invalid_milestone';end if;
 select * into v_row from public.quiz_lqsa_stats where user_id=v_user for update;
 if not found then raise exception 'profile_not_found';end if;
 if p_cycle is distinct from v_row.reward_cycle then raise exception 'reward_cycle_changed';end if;
 if v_row.last_active_date is distinct from (clock_timestamp() at time zone 'Europe/Madrid')::date then raise exception 'daily_visit_required';end if;
 if exists(select 1 from public.quiz_lqsa_streak_rewards where user_id=v_user and cycle_id=p_cycle and milestone=p_milestone) then return jsonb_build_object('status','already_claimed');end if;
 if v_row.streak_days<=0 or ((v_row.streak_days-1)%30)+1<p_milestone then raise exception 'milestone_not_reached';end if;
 v_coins:=600+(p_milestone-5)/5*200;
 insert into public.quiz_lqsa_streak_rewards(user_id,cycle_id,milestone,coins) values(v_user,p_cycle,p_milestone,v_coins);
 update public.quiz_lqsa_stats set coins=coins+v_coins,updated_at=now() where user_id=v_user returning coins into v_balance;
 return jsonb_build_object('status','claimed','reward',v_coins,'balance',v_balance);
end;$$;
revoke all on function public.quiz_lqsa_claim_streak(integer,text) from public,anon;
grant execute on function public.quiz_lqsa_claim_streak(integer,text) to authenticated;
commit;
