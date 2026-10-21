-- Ejecutar después de 008_duel_rewards.sql. Avance al responder ambos, también contra la máquina.
begin;
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
 -- Advance the shared server clock only once both answers are recorded.
 -- The row lock also serializes simultaneous answers and polling requests.
 if v_row.state='playing' and v_now>=v_row.starts_at then
  v_elapsed:=extract(epoch from(v_now-v_row.starts_at));v_index:=floor(v_elapsed/22)::integer;
  if v_index between 0 and 4 and exists(
   select 1 from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_row.player1 and question_index=v_index
  ) and (
   (not v_row.is_bot and exists(select 1 from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_row.player2 and question_index=v_index))
   or (v_row.is_bot and (v_elapsed-v_index*22)*1000>=(v_row.bot_attempts->v_index->>'delay')::integer)
  ) then
   v_row.starts_at:=v_now-make_interval(secs=>((v_index+1)*22)::double precision);
   update public.quiz_lqsa_duels set starts_at=v_row.starts_at where id=p_duel;
  end if;
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

commit;
