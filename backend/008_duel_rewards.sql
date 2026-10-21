-- Ejecutar después de 007_duels.sql y 007_duel_question_seed.sql.
-- Premios: puntos obtenidos al ranking; 50/10/25 monedas por victoria/derrota/empate.
begin;
alter table public.quiz_lqsa_duels add column if not exists is_bot boolean not null default false;
alter table public.quiz_lqsa_duels add column if not exists bot_attempts jsonb;
create table if not exists public.quiz_lqsa_duel_rewards(
 duel_id uuid not null references public.quiz_lqsa_duels(id),user_id uuid not null references auth.users(id),
 points integer not null,coins integer not null, doubled boolean not null default false,
 awarded_at timestamptz not null default clock_timestamp(),primary key(duel_id,user_id)
);
alter table public.quiz_lqsa_duel_rewards enable row level security;
revoke all on public.quiz_lqsa_duel_rewards from public,anon,authenticated;

create or replace function public.quiz_lqsa_finish_duel(p_duel uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.quiz_lqsa_duels%rowtype;v_one integer;v_two integer;v_player uuid;v_score integer;v_other integer;v_coins integer;v_attempt jsonb;
begin
 select * into v_row from public.quiz_lqsa_duels where id=p_duel for update;
 if not found or v_row.state<>'playing' or clock_timestamp()<v_row.starts_at+interval '110 seconds' then return;end if;
 select coalesce(sum(points),0)::integer into v_one from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_row.player1;
 select coalesce(sum(points),0)::integer into v_two from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_row.player2;
 if v_row.is_bot then
  v_two:=0;
  for v_attempt in select value from jsonb_array_elements(v_row.bot_attempts) loop
   if (v_attempt->>'correct')::boolean then v_two:=v_two+10+((20000-(v_attempt->>'delay')::integer)/1000)*2;end if;
  end loop;
 end if;
 foreach v_player in array array[v_row.player1,v_row.player2] loop
  if v_player is null then continue;end if;
  -- Abandonar sin contestar no genera monedas.
  if not exists(select 1 from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_player) then continue;end if;
  v_score:=case when v_player=v_row.player1 then v_one else v_two end;
  v_other:=case when v_player=v_row.player1 then v_two else v_one end;
  v_coins:=case when v_score>v_other then 50 when v_score=v_other then 25 else 10 end;
  insert into public.quiz_lqsa_duel_rewards(duel_id,user_id,points,coins) values(p_duel,v_player,v_score,v_coins) on conflict do nothing;
  if found then update public.quiz_lqsa_stats set points=points+v_score,coins=coins+v_coins,updated_at=now() where user_id=v_player;end if;
 end loop;
 update public.quiz_lqsa_duels set state='finished' where id=p_duel;
end;$$;
revoke all on function public.quiz_lqsa_finish_duel(uuid) from public,anon,authenticated;

create or replace function public.quiz_lqsa_duel_state(p_duel uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid();v_row public.quiz_lqsa_duels%rowtype;v_now timestamptz;v_elapsed numeric;v_index integer;v_question jsonb;v_opponent uuid;v_score integer;v_their_score integer;v_answer jsonb;v_result jsonb;v_attempt jsonb;v_bot_index integer:=0;
begin
 if v_uid is null then raise exception 'authentication_required';end if;
 select * into v_row from public.quiz_lqsa_duels where id=p_duel for update;
 if not found or (v_uid is distinct from v_row.player1 and v_uid is distinct from v_row.player2) then raise exception 'duel_not_found';end if;
 v_now:=clock_timestamp();
 if v_row.state='waiting' then
  if v_row.heartbeat_at<v_now-interval '30 seconds' then update public.quiz_lqsa_duels set state='cancelled' where id=p_duel;v_row.state:='cancelled';
  else update public.quiz_lqsa_duels set heartbeat_at=v_now where id=p_duel;end if;
 end if;
 if v_row.state='playing' and v_now>=v_row.starts_at+interval '110 seconds' then
  perform public.quiz_lqsa_finish_duel(p_duel);select * into v_row from public.quiz_lqsa_duels where id=p_duel;
 end if;
 v_opponent:=case when v_uid=v_row.player1 then v_row.player2 else v_row.player1 end;
 select coalesce(sum(points),0)::integer into v_score from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_uid;
 select coalesce(sum(points),0)::integer into v_their_score from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_opponent;
 if v_row.is_bot then
  v_their_score:=0;
  for v_attempt in select value from jsonb_array_elements(v_row.bot_attempts) loop
   if (v_attempt->>'correct')::boolean and extract(epoch from(v_now-v_row.starts_at))*1000>=v_bot_index*22000+(v_attempt->>'delay')::integer then
    v_their_score:=v_their_score+10+((20000-(v_attempt->>'delay')::integer)/1000)*2;
   end if;
   v_bot_index:=v_bot_index+1;
  end loop;
 end if;
 v_result:=jsonb_build_object('id',p_duel,'state',v_row.state,'server_now',v_now,'starts_at',v_row.starts_at,'is_bot',v_row.is_bot,'my_score',v_score,'opponent_score',v_their_score,'wheel',v_row.wheel,'character_avatar',v_row.character_avatar,
 'opponent',case when v_row.is_bot then jsonb_build_object('alias','Máquina') else(select jsonb_build_object('alias',alias,'avatar',avatar_id) from public.quiz_lqsa_stats where user_id=v_opponent)end,
 'reward',(select jsonb_build_object('points',points,'coins',coins,'doubled',doubled) from public.quiz_lqsa_duel_rewards where duel_id=p_duel and user_id=v_uid));
 if v_row.state='playing' and v_now>=v_row.starts_at then
  v_elapsed:=extract(epoch from(v_now-v_row.starts_at));v_index:=floor(v_elapsed/22)::integer;
  if v_index between 0 and 4 then
   v_question:=v_row.questions->v_index;
   select jsonb_build_object('option',option_index,'points',points) into v_answer from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_uid and question_index=v_index;
   v_result:=v_result||jsonb_build_object('index',v_index,'question',v_question-'correct_index','remaining_ms',greatest(0,floor((20-(v_elapsed-v_index*22))*1000)),'answer',v_answer);
   if v_answer is not null or v_elapsed-v_index*22>=20 then v_result:=v_result||jsonb_build_object('correct_index',(v_question->>'correct_index')::integer);end if;
  end if;
 end if;
 return v_result;
end;$$;

create or replace function public.quiz_lqsa_start_bot_duel() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid();v_id uuid;v_wheel jsonb;v_avatar text;v_questions jsonb;v_attempts jsonb;v_old uuid;
begin
 if v_uid is null then raise exception 'authentication_required';end if;
 if not exists(select 1 from public.quiz_lqsa_stats where user_id=v_uid and alias is not null) then raise exception 'profile_required';end if;
 perform pg_advisory_xact_lock(71420316);
 for v_old in select id from public.quiz_lqsa_duels where(player1=v_uid or player2=v_uid) and state='playing' and starts_at+interval '110 seconds'<=clock_timestamp() loop perform public.quiz_lqsa_finish_duel(v_old);end loop;
 update public.quiz_lqsa_duels set state='cancelled' where player1=v_uid and state='waiting';
 select id into v_id from public.quiz_lqsa_duels where(player1=v_uid or player2=v_uid) and state='playing' order by created_at desc limit 1;
 if found then return public.quiz_lqsa_duel_state(v_id);end if;
 select jsonb_agg(avatar_id) into v_wheel from(select avatar_id from public.quiz_lqsa_duel_questions where avatar_id is not null group by avatar_id having count(*)>=5 order by random() limit 8) pool;
 if jsonb_array_length(coalesce(v_wheel,'[]'::jsonb))<>8 then raise exception 'duel_questions_missing';end if;
 v_avatar:=v_wheel->>(floor(random()*8)::integer);
 select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'correct_index',correct_index)) into v_questions from(select * from public.quiz_lqsa_duel_questions where avatar_id=v_avatar order by random() limit 5) q;
 select jsonb_agg(jsonb_build_object('delay',3000+floor(random()*14000)::integer,'correct',random()<.65)) into v_attempts from generate_series(1,5);
 insert into public.quiz_lqsa_duels(player1,state,starts_at,questions,wheel,character_avatar,is_bot,bot_attempts) values(v_uid,'playing',clock_timestamp()+interval '6 seconds',v_questions,v_wheel,v_avatar,true,v_attempts) returning id into v_id;
 return public.quiz_lqsa_duel_state(v_id);
end;$$;
revoke all on function public.quiz_lqsa_start_bot_duel() from public,anon;
grant execute on function public.quiz_lqsa_start_bot_duel() to authenticated;

create or replace function public.quiz_lqsa_double_duel_coins(p_duel uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_reward public.quiz_lqsa_duel_rewards%rowtype;v_balance bigint;
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 select * into v_reward from public.quiz_lqsa_duel_rewards where duel_id=p_duel and user_id=auth.uid() for update;
 if not found then raise exception 'duel_reward_missing';end if;
 if v_reward.doubled then return jsonb_build_object('status','already_claimed','coins',v_reward.coins*2);end if;
 update public.quiz_lqsa_duel_rewards set doubled=true where duel_id=p_duel and user_id=auth.uid();
 update public.quiz_lqsa_stats set coins=coins+v_reward.coins,updated_at=now() where user_id=auth.uid() returning coins into v_balance;
 return jsonb_build_object('status','claimed','coins',v_reward.coins*2,'balance',v_balance);
end;$$;
revoke all on function public.quiz_lqsa_double_duel_coins(uuid) from public,anon;
grant execute on function public.quiz_lqsa_double_duel_coins(uuid) to authenticated;
create or replace function public.quiz_lqsa_join_duel() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid();v_id uuid;v_questions jsonb;v_wheel jsonb;v_avatar text;v_now timestamptz:=clock_timestamp();v_old uuid;
begin
 if v_uid is null then raise exception 'authentication_required';end if;
 if not exists(select 1 from public.quiz_lqsa_stats where user_id=v_uid and alias is not null) then raise exception 'profile_required';end if;
 -- Serialize joins and cancellation so no player is paired twice.
 perform pg_advisory_xact_lock(71420316);
 update public.quiz_lqsa_duels set state='cancelled' where state='waiting' and heartbeat_at<v_now-interval '30 seconds';
 for v_old in select id from public.quiz_lqsa_duels where state='playing' and starts_at+interval '110 seconds'<=v_now loop perform public.quiz_lqsa_finish_duel(v_old);end loop;
 select id into v_id from public.quiz_lqsa_duels where (player1=v_uid or player2=v_uid) and state in('waiting','playing') order by created_at limit 1;
 if found then return public.quiz_lqsa_duel_state(v_id);end if;
 select id into v_id from public.quiz_lqsa_duels where state='waiting' and player1<>v_uid and heartbeat_at>=v_now-interval '30 seconds' order by created_at limit 1 for update;
 if found then
  select jsonb_agg(avatar_id) into v_wheel from(select avatar_id from public.quiz_lqsa_duel_questions where avatar_id is not null group by avatar_id having count(*)>=5 order by random() limit 8) pool;
  if jsonb_array_length(coalesce(v_wheel,'[]'::jsonb))<>8 then raise exception 'duel_questions_missing';end if;
  v_avatar:=v_wheel->>floor(random()*8)::integer;
  select jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options,'correct_index',correct_index)) into v_questions from(select * from public.quiz_lqsa_duel_questions where avatar_id=v_avatar order by random() limit 5) q;
  if jsonb_array_length(coalesce(v_questions,'[]'::jsonb))<>5 then raise exception 'duel_questions_missing';end if;
  update public.quiz_lqsa_duels set player2=v_uid,state='playing',questions=v_questions,wheel=v_wheel,character_avatar=v_avatar,starts_at=clock_timestamp()+interval '6 seconds' where id=v_id;
 else insert into public.quiz_lqsa_duels(player1) values(v_uid) returning id into v_id;
 end if;
 return public.quiz_lqsa_duel_state(v_id);
end;$$;


commit;
