-- Quiz LQSA: emparejamiento real y respuestas puntuadas por el servidor.
-- No modifica saldos, ranking ni Daily. Duelo: 5 preguntas, 20 s + 2 s entre preguntas.
begin;
create table if not exists public.quiz_lqsa_duel_questions(
 id text primary key,avatar_id text not null,prompt text not null,options jsonb not null check(jsonb_array_length(options)=3),
 correct_index integer not null check(correct_index between 0 and 2)
);
create table if not exists public.quiz_lqsa_duels(
 id uuid primary key default gen_random_uuid(),
 player1 uuid not null references auth.users(id),player2 uuid references auth.users(id),
 state text not null default 'waiting' check(state in('waiting','playing','finished','cancelled')),
 created_at timestamptz not null default clock_timestamp(),heartbeat_at timestamptz not null default clock_timestamp(),
 starts_at timestamptz,questions jsonb,wheel jsonb,character_avatar text,
 check(player2 is null or player2<>player1)
);
alter table public.quiz_lqsa_duel_questions add column if not exists avatar_id text;
alter table public.quiz_lqsa_duels add column if not exists wheel jsonb;
alter table public.quiz_lqsa_duels add column if not exists character_avatar text;
create index if not exists quiz_lqsa_duel_waiting on public.quiz_lqsa_duels(created_at) where state='waiting';
create table if not exists public.quiz_lqsa_duel_answers(
 duel_id uuid not null references public.quiz_lqsa_duels(id) on delete cascade,
 user_id uuid not null references auth.users(id),question_index integer not null check(question_index between 0 and 4),
 option_index integer not null check(option_index between 0 and 2),points integer not null,
 answered_at timestamptz not null default clock_timestamp(),primary key(duel_id,user_id,question_index)
);
alter table public.quiz_lqsa_duel_questions enable row level security;
alter table public.quiz_lqsa_duels enable row level security;
alter table public.quiz_lqsa_duel_answers enable row level security;
revoke all on public.quiz_lqsa_duel_questions,public.quiz_lqsa_duels,public.quiz_lqsa_duel_answers from public,anon,authenticated;

create or replace function public.quiz_lqsa_duel_state(p_duel uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid();v_row public.quiz_lqsa_duels%rowtype;v_now timestamptz;v_elapsed numeric;v_index integer;v_question jsonb;v_opponent uuid;v_score integer;v_their_score integer;v_answer jsonb;v_result jsonb;
begin
 if v_uid is null then raise exception 'authentication_required';end if;
 select * into v_row from public.quiz_lqsa_duels where id=p_duel for update;
 if not found or (v_uid is distinct from v_row.player1 and v_uid is distinct from v_row.player2) then raise exception 'duel_not_found';end if;
 v_now:=clock_timestamp();
 if v_row.state='waiting' then
  if v_row.heartbeat_at<v_now-interval '30 seconds' then
   update public.quiz_lqsa_duels set state='cancelled' where id=p_duel;v_row.state:='cancelled';
  else update public.quiz_lqsa_duels set heartbeat_at=v_now where id=p_duel;end if;
 end if;
 if v_row.state='playing' and v_now>=v_row.starts_at+interval '110 seconds' then
  update public.quiz_lqsa_duels set state='finished' where id=p_duel;v_row.state:='finished';
 end if;
 v_opponent:=case when v_uid=v_row.player1 then v_row.player2 else v_row.player1 end;
 select coalesce(sum(points),0)::integer into v_score from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_uid;
 select coalesce(sum(points),0)::integer into v_their_score from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_opponent;
 v_result:=jsonb_build_object('id',p_duel,'state',v_row.state,'server_now',v_now,'starts_at',v_row.starts_at,'my_score',v_score,'opponent_score',v_their_score,'wheel',v_row.wheel,'character_avatar',v_row.character_avatar,'opponent',(select jsonb_build_object('alias',alias,'avatar',avatar_id) from public.quiz_lqsa_stats where user_id=v_opponent));
 if v_row.state='playing' and v_now>=v_row.starts_at then
  v_elapsed:=extract(epoch from(v_now-v_row.starts_at));v_index:=floor(v_elapsed/22)::integer;
  if v_index between 0 and 4 then
   v_question:=v_row.questions->v_index;
   select jsonb_build_object('option',option_index,'points',points) into v_answer from public.quiz_lqsa_duel_answers where duel_id=p_duel and user_id=v_uid and question_index=v_index;
   v_result:=v_result||jsonb_build_object('index',v_index,'question',v_question-'correct_index','remaining_ms',greatest(0,floor((20-(v_elapsed-v_index*22))*1000)),'answer',v_answer);
   if v_answer is not null or v_elapsed-v_index*22>=20 then
    v_result:=v_result||jsonb_build_object('correct_index',(v_question->>'correct_index')::integer);
   end if;
  end if;
 end if;
 return v_result;
end;$$;

create or replace function public.quiz_lqsa_join_duel() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid();v_id uuid;v_questions jsonb;v_wheel jsonb;v_avatar text;v_now timestamptz:=clock_timestamp();
begin
 if v_uid is null then raise exception 'authentication_required';end if;
 if not exists(select 1 from public.quiz_lqsa_stats where user_id=v_uid and alias is not null) then raise exception 'profile_required';end if;
 -- Serialize joins and cancellation so no player is paired twice.
 perform pg_advisory_xact_lock(71420316);
 update public.quiz_lqsa_duels set state='cancelled' where state='waiting' and heartbeat_at<v_now-interval '30 seconds';
 update public.quiz_lqsa_duels set state='finished' where state='playing' and starts_at+interval '110 seconds'<=v_now;
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

create or replace function public.quiz_lqsa_cancel_duel(p_duel uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 perform pg_advisory_xact_lock(71420316);
 update public.quiz_lqsa_duels set state='cancelled' where id=p_duel and player1=auth.uid() and state='waiting';
 return public.quiz_lqsa_duel_state(p_duel);
end;$$;

create or replace function public.quiz_lqsa_leave_duel_queue() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 perform pg_advisory_xact_lock(71420316);
 update public.quiz_lqsa_duels set state='cancelled' where player1=auth.uid() and state='waiting';
 select id into v_id from public.quiz_lqsa_duels where (player1=auth.uid() or player2=auth.uid()) and state='playing' and starts_at+interval '110 seconds'>clock_timestamp() order by created_at desc limit 1;
 if found then return public.quiz_lqsa_duel_state(v_id);end if;
 return null;
end;$$;
revoke all on function public.quiz_lqsa_leave_duel_queue() from public,anon;
grant execute on function public.quiz_lqsa_leave_duel_queue() to authenticated;

create or replace function public.quiz_lqsa_answer_duel(p_duel uuid,p_index integer,p_option integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_uid uuid:=auth.uid();v_row public.quiz_lqsa_duels%rowtype;v_elapsed numeric;v_index integer;v_left integer;v_points integer:=0;
begin
 if v_uid is null then raise exception 'authentication_required';end if;
 select * into v_row from public.quiz_lqsa_duels where id=p_duel for update;
 if not found or(v_uid is distinct from v_row.player1 and v_uid is distinct from v_row.player2) then raise exception 'duel_not_found';end if;
 v_elapsed:=extract(epoch from(clock_timestamp()-v_row.starts_at));v_index:=floor(v_elapsed/22)::integer;
 if v_row.state<>'playing' or p_index is null or p_index<>v_index or p_index not between 0 and 4 or v_elapsed<0 or v_elapsed-v_index*22>=20 then raise exception 'question_expired';end if;
 if p_option is null or p_option not between 0 and 2 then raise exception 'invalid_option';end if;
 v_left:=greatest(0,floor(20-(v_elapsed-v_index*22))::integer);
 if p_option=(v_row.questions->v_index->>'correct_index')::integer then v_points:=10+v_left*2;end if;
 insert into public.quiz_lqsa_duel_answers(duel_id,user_id,question_index,option_index,points) values(p_duel,v_uid,p_index,p_option,v_points) on conflict do nothing;
 return public.quiz_lqsa_duel_state(p_duel);
end;$$;
revoke all on function public.quiz_lqsa_join_duel() from public,anon;
revoke all on function public.quiz_lqsa_duel_state(uuid) from public,anon;
revoke all on function public.quiz_lqsa_cancel_duel(uuid) from public,anon;
revoke all on function public.quiz_lqsa_answer_duel(uuid,integer,integer) from public,anon;
grant execute on function public.quiz_lqsa_join_duel(),public.quiz_lqsa_duel_state(uuid),public.quiz_lqsa_cancel_duel(uuid),public.quiz_lqsa_answer_duel(uuid,integer,integer) to authenticated;
commit;
