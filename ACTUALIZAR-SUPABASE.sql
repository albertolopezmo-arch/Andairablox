-- ACTUALIZACION QUIZ LQSA 0.2.0
-- Para el proyecto existente con 001, 002 y 003 ya instalados.
-- Conserva usuarios, saldos y ranking. Si hay alias duplicados, se detiene sin modificar datos.
begin;
-- Reparar instalaciones que no recibieron las columnas de la migración 003.
alter table public.quiz_lqsa_stats
 add column if not exists daily_completed_date date,
 add column if not exists daily_last_score integer not null default 0;

-- ARCHIVO: 004_daily_speed_rewards.sql
-- Ejecutar después de 003_daily_scoring.sql. Conserva saldos y partidas anteriores.

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


-- ARCHIVO: 005_streak_rewards.sql

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


-- ARCHIVO: 006_unique_alias.sql
-- Quiz LQSA: comprobación y exclusividad del alias, sin distinguir mayúsculas.
-- Si ya existen alias duplicados, se detiene sin modificar usuarios ni saldos.

do $$ begin
 if exists(select 1 from public.quiz_lqsa_stats where alias is not null group by lower(btrim(alias)) having count(*)>1) then
  raise exception 'Existen alias duplicados. Resolverlos antes de activar la exclusividad.';
 end if;
end $$;
create unique index if not exists quiz_lqsa_unique_alias on public.quiz_lqsa_stats(lower(btrim(alias))) where alias is not null;
create or replace function public.quiz_lqsa_alias_available(p_alias text) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 if p_alias is null or char_length(btrim(p_alias)) not between 3 and 20 or p_alias ~ '[[:cntrl:]]' then return false;end if;
 return not exists(select 1 from public.quiz_lqsa_stats where lower(btrim(alias))=lower(btrim(p_alias)) and user_id<>auth.uid());
end;$$;
revoke all on function public.quiz_lqsa_alias_available(text) from public,anon;
grant execute on function public.quiz_lqsa_alias_available(text) to authenticated;
create or replace function public.quiz_lqsa_save_profile(p_alias text,p_avatar_id text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'authentication_required';end if;
 if p_alias is null or char_length(btrim(p_alias)) not between 3 and 20 or p_alias ~ '[[:cntrl:]]' then raise exception 'invalid_alias';end if;
 if p_avatar_id is null or p_avatar_id !~ '^avatar-([1-9]|1[0-9]|2[0-8])$' then raise exception 'invalid_avatar';end if;
 insert into public.quiz_lqsa_stats(user_id,alias,avatar_id) values(v_user,btrim(p_alias),p_avatar_id)
 on conflict(user_id) do update set alias=excluded.alias,avatar_id=excluded.avatar_id,updated_at=now();
exception when unique_violation then raise exception 'alias_unavailable';
end;$$;
revoke all on function public.quiz_lqsa_save_profile(text,text) from public,anon;
grant execute on function public.quiz_lqsa_save_profile(text,text) to authenticated;


-- ARCHIVO: 007_duels.sql
-- Quiz LQSA: emparejamiento real y respuestas puntuadas por el servidor.
-- No modifica saldos, ranking ni Daily. Duelo: 5 preguntas, 20 s + 2 s entre preguntas.

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


-- ARCHIVO: 007_duel_question_seed.sql
-- Ejecutar después de 007_duels.sql. 5 preguntas por personaje; banco privado.
insert into public.quiz_lqsa_duel_questions(id,avatar_id,prompt,options,correct_index)
select id,avatar_id,prompt,options,correct_index from jsonb_to_recordset($questions$[{"id":"duel-1-1","avatar_id":"avatar-1","prompt":"¿Quién interpreta a Fermín en la serie?","options":["Fernando Tejero","Adrià Collado","Pablo Chiapella"],"correct_index":0},{"id":"duel-1-5","avatar_id":"avatar-1","prompt":"¿Qué especialidad malagueña prepara Fermín?","options":["Espetos","Croquetas","Paella"],"correct_index":0},{"id":"duel-1-4","avatar_id":"avatar-1","prompt":"¿Qué apellido tiene Fermín?","options":["Trujillo","Quiroga","Figueroa"],"correct_index":0},{"id":"duel-1-2","avatar_id":"avatar-1","prompt":"¿Quién es la hija de Fermín?","options":["Goya Gutiérrez","Victoria Rafaela","Lola Reynolds"],"correct_index":2},{"id":"duel-1-3","avatar_id":"avatar-1","prompt":"¿Con qué actriz se casa Fermín?","options":["Judith Becker","Lola Reynolds","Estela Reynolds"],"correct_index":2},{"id":"duel-2-1","avatar_id":"avatar-2","prompt":"¿Quién interpreta a Berta en la serie?","options":["Nathalie Seseña","Mamen García","Petra Martínez"],"correct_index":0},{"id":"duel-2-5","avatar_id":"avatar-2","prompt":"¿Qué negocio comparte Berta con Antonio?","options":["Mariscos Recio","Max & Henry","Cafebrería Quiroga"],"correct_index":0},{"id":"duel-2-3","avatar_id":"avatar-2","prompt":"¿Quién es la hija de Berta?","options":["Alba Recio","Goya Gutiérrez","Araceli Madariaga"],"correct_index":0},{"id":"duel-2-2","avatar_id":"avatar-2","prompt":"¿Quién es el marido de Berta?","options":["Dylan","Fermín Trujillo","Antonio Recio"],"correct_index":2},{"id":"duel-2-4","avatar_id":"avatar-2","prompt":"¿Qué apellido tiene Berta?","options":["Calatrava","Villanueva","Escobar"],"correct_index":2},{"id":"duel-3-2","avatar_id":"avatar-3","prompt":"¿Quién es la esposa de Antonio Recio?","options":["María Jesús","Justi","Berta Escobar"],"correct_index":2},{"id":"duel-3-1","avatar_id":"avatar-3","prompt":"¿Quién interpreta a Antonio en la serie?","options":["Ricardo Arroyo","Jordi Sánchez","Eduardo Gómez"],"correct_index":1},{"id":"duel-3-5","avatar_id":"avatar-3","prompt":"¿Cómo se llama el negocio de Antonio?","options":["Max & Henry","Cafebrería Quiroga","Mariscos Recio"],"correct_index":2},{"id":"duel-3-3","avatar_id":"avatar-3","prompt":"¿Quién es la hija de Antonio?","options":["Nines Chacón","Maite Figueroa","Alba Recio"],"correct_index":2},{"id":"duel-3-4","avatar_id":"avatar-3","prompt":"¿Qué vende principalmente Antonio Recio?","options":["Pescado y marisco congelado","Ropa deportiva","Material de oficina"],"correct_index":0},{"id":"duel-4-1","avatar_id":"avatar-4","prompt":"¿Quién interpreta a Fina en la serie?","options":["Petra Martínez","Macarena Gómez","Isabel Ordaz"],"correct_index":0},{"id":"duel-4-5","avatar_id":"avatar-4","prompt":"¿Qué intenta eludir Fina en la temporada 15?","options":["Un embargo bancario","La justicia","Una mudanza"],"correct_index":1},{"id":"duel-4-4","avatar_id":"avatar-4","prompt":"¿Qué vecino quiere convertir a Fina en su único amigo?","options":["Enrique Pastor","Coque Calatrava","Vicente Maroto"],"correct_index":2},{"id":"duel-4-3","avatar_id":"avatar-4","prompt":"¿Cuál es el apellido de Fina?","options":["Palomares","Figueroa","Villanueva"],"correct_index":0},{"id":"duel-4-2","avatar_id":"avatar-4","prompt":"¿Cuál es el nombre de pila de doña Fina?","options":["Yolanda","Josefina","Victoria Rafaela"],"correct_index":1},{"id":"duel-5-5","avatar_id":"avatar-5","prompt":"¿Qué cargo comunitario asume Judith en la quinta temporada?","options":["Administrador de fincas","Presidenta","Conserje"],"correct_index":1},{"id":"duel-5-2","avatar_id":"avatar-5","prompt":"¿Qué profesión ejerce Judith?","options":["Peluquera","Comercial","Psicóloga"],"correct_index":2},{"id":"duel-5-1","avatar_id":"avatar-5","prompt":"¿Quién interpreta a Judith en la serie?","options":["Cristina Castaño","Petra Martínez","María Adánez"],"correct_index":0},{"id":"duel-5-4","avatar_id":"avatar-5","prompt":"¿Cómo se llama el hijo de Judith?","options":["Dylan","Fran","Josito"],"correct_index":0},{"id":"duel-5-3","avatar_id":"avatar-5","prompt":"¿Quién es el padre del hijo de Judith?","options":["Antonio Recio","Vicente Maroto","Enrique Pastor"],"correct_index":2},{"id":"duel-6-4","avatar_id":"avatar-6","prompt":"¿Quién fue la esposa de Javi?","options":["Mari Tere Valverde","Lola Reynolds","Fina Palomares"],"correct_index":1},{"id":"duel-6-2","avatar_id":"avatar-6","prompt":"¿Quién es el padre de Javi?","options":["Vicente Maroto","Amador Rivas","Enrique Pastor"],"correct_index":0},{"id":"duel-6-1","avatar_id":"avatar-6","prompt":"¿Quién interpreta a Javier en la serie?","options":["Ernesto Sevilla","Antonio Pagudo","Luis Miguel Seguí"],"correct_index":1},{"id":"duel-6-3","avatar_id":"avatar-6","prompt":"¿Quién es la madre de Javi?","options":["Menchu Carrascosa","Goya Gutiérrez","Justi"],"correct_index":1},{"id":"duel-6-5","avatar_id":"avatar-6","prompt":"¿Cuál es el apodo de Javi?","options":["La Chusa","El hombre cojín","El Pelocho"],"correct_index":2},{"id":"duel-7-4","avatar_id":"avatar-7","prompt":"¿Quién fue el marido de Lola?","options":["Javi Maroto","Enrique Pastor","Fermín Trujillo"],"correct_index":0},{"id":"duel-7-5","avatar_id":"avatar-7","prompt":"¿A qué ciudad viaja Lola para participar en una telenovela?","options":["Francavilla y Sacromonte","Villazarcillo","Miami"],"correct_index":2},{"id":"duel-7-2","avatar_id":"avatar-7","prompt":"¿Quién es el padre de Lola?","options":["Fermín Trujillo","Amador Rivas","Enrique Pastor"],"correct_index":0},{"id":"duel-7-3","avatar_id":"avatar-7","prompt":"¿Quién es la madre de Lola?","options":["Estela Reynolds","Justi","Goya Gutiérrez"],"correct_index":0},{"id":"duel-7-1","avatar_id":"avatar-7","prompt":"¿Quién interpreta a Lola en la serie?","options":["Miren Ibarguren","Amparo Valle","Macarena Gómez"],"correct_index":2},{"id":"duel-8-1","avatar_id":"avatar-8","prompt":"¿Quién interpreta a Amador en la serie?","options":["Ricardo Arroyo","Ernesto Sevilla","Pablo Chiapella"],"correct_index":2},{"id":"duel-8-3","avatar_id":"avatar-8","prompt":"¿Quién es el hermano de Amador?","options":["Fermín Trujillo","Antonio Recio","Teodoro Rivas"],"correct_index":2},{"id":"duel-8-2","avatar_id":"avatar-8","prompt":"¿Quién es la madre de Amador?","options":["Judith Becker","Justi","Berta Escobar"],"correct_index":1},{"id":"duel-8-4","avatar_id":"avatar-8","prompt":"¿Con quién forma Amador la pareja de los Cuquis?","options":["Nines Chacón","Reyes","Maite Figueroa"],"correct_index":2},{"id":"duel-8-5","avatar_id":"avatar-8","prompt":"¿Qué apodo tiene Amador?","options":["El Pelocho","Mente Fría","El Cuqui"],"correct_index":2},{"id":"duel-9-2","avatar_id":"avatar-9","prompt":"¿Quién es el hermano de Teodoro?","options":["Amador Rivas","Dylan","Antonio Recio"],"correct_index":0},{"id":"duel-9-4","avatar_id":"avatar-9","prompt":"¿Qué apellido comparte Teodoro con Amador?","options":["Maroto","Carrascosa","Rivas"],"correct_index":2},{"id":"duel-9-3","avatar_id":"avatar-9","prompt":"¿Quién es la madre de Teodoro?","options":["Maite Figueroa","Berta Escobar","Justi"],"correct_index":2},{"id":"duel-9-5","avatar_id":"avatar-9","prompt":"¿Con qué hija de Menchu mantiene una relación Teodoro?","options":["Yoli","Araceli Madariaga","Nines Chacón"],"correct_index":0},{"id":"duel-9-1","avatar_id":"avatar-9","prompt":"¿Quién interpreta a Teodoro en la serie?","options":["Ernesto Sevilla","Adrià Collado","José Luis Gil"],"correct_index":0},{"id":"duel-10-4","avatar_id":"avatar-10","prompt":"¿Cuál era el trabajo de Raquel en la constructora?","options":["Comercial","Psicóloga","Conserje-jardinero"],"correct_index":0},{"id":"duel-10-1","avatar_id":"avatar-10","prompt":"¿Quién interpreta a Raquel en la serie?","options":["Macarena Gómez","Paz Padilla","Vanesa Romero"],"correct_index":2},{"id":"duel-10-5","avatar_id":"avatar-10","prompt":"¿Qué enamorado de Raquel vive en Villazarcillo?","options":["Maxi","Minguito","Fran"],"correct_index":1},{"id":"duel-10-2","avatar_id":"avatar-10","prompt":"¿Quién es la prima de Raquel?","options":["La Chusa","Raquel Villanueva","Nines Chacón"],"correct_index":2},{"id":"duel-10-3","avatar_id":"avatar-10","prompt":"¿Qué apellido tiene Raquel?","options":["Figueroa","Villanueva","Sagastume"],"correct_index":1},{"id":"duel-11-5","avatar_id":"avatar-11","prompt":"¿Cuál es el apellido de Maite?","options":["Villanueva","Figueroa","Trujillo"],"correct_index":1},{"id":"duel-11-2","avatar_id":"avatar-11","prompt":"¿Qué apodo tiene Maite?","options":["El hombre cojín","El Cuqui","La Cuqui"],"correct_index":2},{"id":"duel-11-3","avatar_id":"avatar-11","prompt":"¿Con quién forma Maite la pareja de los Cuquis?","options":["Amador Rivas","Agustín Gordillo","Fermín Trujillo"],"correct_index":0},{"id":"duel-11-1","avatar_id":"avatar-11","prompt":"¿Quién interpreta a Maite en la serie?","options":["Petra Martínez","Eva Isanta","Isabel Ordaz"],"correct_index":1},{"id":"duel-11-4","avatar_id":"avatar-11","prompt":"¿Quién es una de las hijas de Maite?","options":["Carlota Rivas","Fina Palomares","Justi"],"correct_index":0},{"id":"duel-12-2","avatar_id":"avatar-12","prompt":"¿Quién es el hijo de Vicente?","options":["Leo Romaní","Javi Maroto","Josito"],"correct_index":1},{"id":"duel-12-5","avatar_id":"avatar-12","prompt":"¿Qué apellido tiene Vicente?","options":["Maroto","Carrascosa","Figueroa"],"correct_index":0},{"id":"duel-12-1","avatar_id":"avatar-12","prompt":"¿Quién interpreta a Vicente en la serie?","options":["Pablo Chiapella","Ricardo Arroyo","Nacho Guerreros"],"correct_index":1},{"id":"duel-12-4","avatar_id":"avatar-12","prompt":"¿Qué apodo tiene Vicente?","options":["El hombre cojín","La Chusa","Mente Fría"],"correct_index":0},{"id":"duel-12-3","avatar_id":"avatar-12","prompt":"¿Quién fue la esposa de Vicente?","options":["Goya Gutiérrez","Alba Recio","Lola Reynolds"],"correct_index":0},{"id":"duel-13-2","avatar_id":"avatar-13","prompt":"¿Qué cargo municipal tuvo Enrique?","options":["Concejal de Juventud y Tiempo Libre","Pianista","Peluquera"],"correct_index":0},{"id":"duel-13-4","avatar_id":"avatar-13","prompt":"¿Con quién tiene Enrique a Dylan?","options":["Judith Becker","Goya Gutiérrez","María Jesús"],"correct_index":0},{"id":"duel-13-5","avatar_id":"avatar-13","prompt":"¿Cómo se llama el hijo de Enrique y Araceli?","options":["Josito","Dylan","Fran"],"correct_index":2},{"id":"duel-13-3","avatar_id":"avatar-13","prompt":"¿Quién fue la esposa de Enrique y madre de Fran?","options":["Lola Reynolds","Araceli Madariaga","Raquel Villanueva"],"correct_index":1},{"id":"duel-13-1","avatar_id":"avatar-13","prompt":"¿Quién interpreta a Enrique en la serie?","options":["José Luis Gil","Carlos Areces","Luis Merlo"],"correct_index":0},{"id":"duel-14-4","avatar_id":"avatar-14","prompt":"¿Con qué prima de Raquel mantiene una relación Coque?","options":["Nines Chacón","Antonia Calendaria","Menchu Carrascosa"],"correct_index":0},{"id":"duel-14-2","avatar_id":"avatar-14","prompt":"¿Qué trabajo desempeña Coque en la comunidad?","options":["Conserje-jardinero","Pianista","Limpieza"],"correct_index":0},{"id":"duel-14-1","avatar_id":"avatar-14","prompt":"¿Quién interpreta a Coque en la serie?","options":["Ernesto Sevilla","Nacho Guerreros","José Luis Gil"],"correct_index":1},{"id":"duel-14-5","avatar_id":"avatar-14","prompt":"¿Qué vivienda móvil utiliza Coque?","options":["Caravana","Piso piloto","Una casa rural"],"correct_index":0},{"id":"duel-14-3","avatar_id":"avatar-14","prompt":"¿Qué apellido tiene Coque?","options":["Calatrava","Valverde","Carrascosa"],"correct_index":0},{"id":"duel-15-2","avatar_id":"avatar-15","prompt":"¿Cuál es el nombre de pila de la Chusa?","options":["Miranda","Noelia","María Jesús"],"correct_index":2},{"id":"duel-15-1","avatar_id":"avatar-15","prompt":"¿Quién interpreta a Chusa en la serie?","options":["Paz Padilla","Cristina Medina","Antonia San Juan"],"correct_index":0},{"id":"duel-15-5","avatar_id":"avatar-15","prompt":"¿Cómo se conoce habitualmente a María Jesús?","options":["El Cuqui","La Chusa","El Pelocho"],"correct_index":1},{"id":"duel-15-4","avatar_id":"avatar-15","prompt":"¿Qué personaje encarga a la Chusa escribir su novela?","options":["Estela Reynolds","Noelia Balmaseda","Maite Figueroa"],"correct_index":2},{"id":"duel-15-3","avatar_id":"avatar-15","prompt":"¿Qué trabajo doméstico realiza la Chusa?","options":["Limpieza","Concejal de Juventud y Tiempo Libre","Conserje-jardinero"],"correct_index":0},{"id":"duel-16-4","avatar_id":"avatar-16","prompt":"¿Qué instala Minguito en su olivar para hacerse millonario?","options":["Paneles publicitarios","Generadores eólicos","Un coche"],"correct_index":1},{"id":"duel-16-2","avatar_id":"avatar-16","prompt":"¿De qué vecina está enamorado Minguito?","options":["Fina Palomares","Raquel Villanueva","Justi"],"correct_index":1},{"id":"duel-16-3","avatar_id":"avatar-16","prompt":"¿En qué pueblo tiene Minguito su olivar?","options":["Francavilla y Sacromonte","Villazarcillo","Miami"],"correct_index":1},{"id":"duel-16-1","avatar_id":"avatar-16","prompt":"¿Quién interpreta a Minguito en la serie?","options":["Max Marieges","Adrià Collado","José Luis Gil"],"correct_index":0},{"id":"duel-16-5","avatar_id":"avatar-16","prompt":"¿Qué cultivo tiene Minguito?","options":["Olivos","Viñedos","Naranjos"],"correct_index":0},{"id":"duel-17-5","avatar_id":"avatar-17","prompt":"¿De qué nombre es diminutivo Yoli?","options":["Victoria Rafaela","Yolanda","Noelia"],"correct_index":1},{"id":"duel-17-4","avatar_id":"avatar-17","prompt":"¿Qué hermano de Amador es pareja de Yoli?","options":["Josito","Teodoro Rivas","Amador Rivas"],"correct_index":1},{"id":"duel-17-3","avatar_id":"avatar-17","prompt":"¿Cómo se llama el hermano de Yoli?","options":["Dylan","Josito","Fran"],"correct_index":1},{"id":"duel-17-2","avatar_id":"avatar-17","prompt":"¿Quién es la madre de Yoli?","options":["Maite Figueroa","Menchu Carrascosa","Estela Reynolds"],"correct_index":1},{"id":"duel-17-1","avatar_id":"avatar-17","prompt":"¿Quién interpreta a Yoli en la serie?","options":["Miren Ibarguren","Cristina Medina","Eva Isanta"],"correct_index":0},{"id":"duel-18-1","avatar_id":"avatar-18","prompt":"¿Quién interpreta a Menchu en la serie?","options":["Paz Padilla","Loles León","Antonia San Juan"],"correct_index":1},{"id":"duel-18-4","avatar_id":"avatar-18","prompt":"¿Qué apellido tiene Menchu?","options":["Escobar","Figueroa","Carrascosa"],"correct_index":2},{"id":"duel-18-2","avatar_id":"avatar-18","prompt":"¿Quién es la hija de Menchu?","options":["Judith Becker","Estela Reynolds","Yoli"],"correct_index":2},{"id":"duel-18-3","avatar_id":"avatar-18","prompt":"¿Cómo se llama el hijo de Menchu?","options":["Dylan","Fran","Josito"],"correct_index":2},{"id":"duel-18-5","avatar_id":"avatar-18","prompt":"¿Qué cargo asume Menchu en la temporada 11?","options":["Presidenta","Administrador de fincas","Conserje"],"correct_index":0},{"id":"duel-19-5","avatar_id":"avatar-19","prompt":"¿Cuál es una de las personalidades de Agustín?","options":["Don Simón","Fran","Dylan"],"correct_index":0},{"id":"duel-19-3","avatar_id":"avatar-19","prompt":"¿Quién alquila una habitación a Agustín en Villa Borderline?","options":["Amador Rivas","Josito","Minguito"],"correct_index":0},{"id":"duel-19-2","avatar_id":"avatar-19","prompt":"¿Qué pianista es amigo de Agustín?","options":["Bruno Quiroga","Vicente Maroto","Coque Calatrava"],"correct_index":0},{"id":"duel-19-4","avatar_id":"avatar-19","prompt":"¿Cuánto paga Agustín por la habitación en Villa Borderline?","options":["300 euros","900 euros","100 euros"],"correct_index":0},{"id":"duel-19-1","avatar_id":"avatar-19","prompt":"¿Quién interpreta a Agustín en la serie?","options":["José Luis Gil","Max Marieges","Carlos Areces"],"correct_index":2},{"id":"duel-20-4","avatar_id":"avatar-20","prompt":"¿De qué lugares es marquesa Victoria Rafaela?","options":["Francavilla y Sacromonte","Miami","Villazarcillo"],"correct_index":0},{"id":"duel-20-1","avatar_id":"avatar-20","prompt":"¿Quién interpreta a Marquesa en la serie?","options":["Mamen García","Nathalie Seseña","Isabel Ordaz"],"correct_index":0},{"id":"duel-20-3","avatar_id":"avatar-20","prompt":"¿Cómo se llama la hermana de la marquesa?","options":["Yolanda","Victoria Rafaela","Noelia"],"correct_index":2},{"id":"duel-20-2","avatar_id":"avatar-20","prompt":"¿Cómo se llama la marquesa?","options":["Yolanda","Miranda","Victoria Rafaela"],"correct_index":2},{"id":"duel-20-5","avatar_id":"avatar-20","prompt":"¿En qué edificio vive la marquesa?","options":["Piso piloto","Contubernio 49","Caravana"],"correct_index":1},{"id":"duel-21-2","avatar_id":"avatar-21","prompt":"¿Cuál es la actividad artística de Bruno?","options":["Conserje","Psicóloga","Pianista"],"correct_index":2},{"id":"duel-21-5","avatar_id":"avatar-21","prompt":"¿Qué personaje comparte con Bruno su amistad desde el psiquiátrico?","options":["Maxi","Agustín Gordillo","Fermín Trujillo"],"correct_index":1},{"id":"duel-21-1","avatar_id":"avatar-21","prompt":"¿Quién interpreta a Bruno en la serie?","options":["Fernando Tejero","Luis Merlo","Luis Miguel Seguí"],"correct_index":1},{"id":"duel-21-4","avatar_id":"avatar-21","prompt":"¿Qué psicóloga atiende a Bruno?","options":["Antonia Calendaria","Goya Gutiérrez","Judith Becker"],"correct_index":2},{"id":"duel-21-3","avatar_id":"avatar-21","prompt":"¿Qué apellido tiene Bruno?","options":["Quiroga","Maroto","Figueroa"],"correct_index":0},{"id":"duel-22-2","avatar_id":"avatar-22","prompt":"¿Quién fue el marido de Araceli?","options":["Fermín Trujillo","Coque Calatrava","Enrique Pastor"],"correct_index":2},{"id":"duel-22-3","avatar_id":"avatar-22","prompt":"¿Cómo se llama el hijo de Araceli?","options":["Josito","Dylan","Fran"],"correct_index":2},{"id":"duel-22-5","avatar_id":"avatar-22","prompt":"¿Qué pareja acompaña a Araceli cuando regresa a Montepinar?","options":["Reyes","Justi","Lola Reynolds"],"correct_index":0},{"id":"duel-22-1","avatar_id":"avatar-22","prompt":"¿Quién interpreta a Araceli en la serie?","options":["Mariví Bilbao","Emma Penella","Isabel Ordaz"],"correct_index":2},{"id":"duel-22-4","avatar_id":"avatar-22","prompt":"¿Qué profesión ejercía Araceli al principio?","options":["Concejal de Juventud y Tiempo Libre","Comercial","Peluquera"],"correct_index":2},{"id":"duel-23-3","avatar_id":"avatar-23","prompt":"¿Con qué vecina comparte Mari Tere el piso piloto?","options":["Judith Becker","Estela Reynolds","Izaskun Sagastume"],"correct_index":2},{"id":"duel-23-5","avatar_id":"avatar-23","prompt":"¿Qué compran Mari Tere e Izaskun para combatir el aburrimiento?","options":["Un coche","Una motocicleta","Generadores eólicos"],"correct_index":0},{"id":"duel-23-2","avatar_id":"avatar-23","prompt":"¿Qué apellido tiene Mari Tere?","options":["Valverde","Trujillo","Rivas"],"correct_index":0},{"id":"duel-23-4","avatar_id":"avatar-23","prompt":"¿Qué vivienda ocupan Mari Tere e Izaskun?","options":["Caravana","Piso piloto","Un chalet en la playa"],"correct_index":1},{"id":"duel-23-1","avatar_id":"avatar-23","prompt":"¿Quién interpreta a Mari Tere en la serie?","options":["Emma Penella","Gemma Cuervo","Isabel Ordaz"],"correct_index":1},{"id":"duel-24-3","avatar_id":"avatar-24","prompt":"¿Con qué vecina comparte Izaskun el piso piloto?","options":["Menchu Carrascosa","Mari Tere Valverde","Fina Palomares"],"correct_index":1},{"id":"duel-24-4","avatar_id":"avatar-24","prompt":"¿Qué vivienda ocupan Izaskun y Mari Tere?","options":["Caravana","Piso piloto","Un chalet en la playa"],"correct_index":1},{"id":"duel-24-1","avatar_id":"avatar-24","prompt":"¿Quién interpreta a Izaskun en la serie?","options":["Mamen García","Gemma Cuervo","Mariví Bilbao"],"correct_index":2},{"id":"duel-24-2","avatar_id":"avatar-24","prompt":"¿Qué apellido tiene Izaskun?","options":["Recio","Escobar","Sagastume"],"correct_index":2},{"id":"duel-24-5","avatar_id":"avatar-24","prompt":"¿Cómo llaman Izaskun y Mari Tere a Raquel?","options":["María Jesús","Miranda","Noelia"],"correct_index":1},{"id":"duel-25-1","avatar_id":"avatar-25","prompt":"¿Quién interpreta a Charo en la serie?","options":["Emma Penella","Cristina Castaño","Petra Martínez"],"correct_index":0},{"id":"duel-25-2","avatar_id":"avatar-25","prompt":"¿Quién es la hija de doña Charo?","options":["Araceli Madariaga","Justi","Nines Chacón"],"correct_index":0},{"id":"duel-25-4","avatar_id":"avatar-25","prompt":"¿Quién es el nieto de doña Charo?","options":["Josito","Fran","Dylan"],"correct_index":1},{"id":"duel-25-3","avatar_id":"avatar-25","prompt":"¿Quién es el yerno de doña Charo?","options":["Minguito","Sergio Arias","Enrique Pastor"],"correct_index":2},{"id":"duel-25-5","avatar_id":"avatar-25","prompt":"¿Qué animal llega al jardín de los Pastor por una herencia de la hermana de Charo?","options":["Un caballo","Una vaca","Una oveja"],"correct_index":1},{"id":"duel-26-2","avatar_id":"avatar-26","prompt":"¿Qué apodo tiene Maxi?","options":["Mente Fría","El Pelocho","La Cuqui"],"correct_index":0},{"id":"duel-26-5","avatar_id":"avatar-26","prompt":"¿Qué apellido tiene Maxi?","options":["Villanueva","Escobar","Angulo"],"correct_index":2},{"id":"duel-26-1","avatar_id":"avatar-26","prompt":"¿Quién interpreta a Maxi en la serie?","options":["Víctor Palmero","Eduardo Gómez","Max Marieges"],"correct_index":1},{"id":"duel-26-3","avatar_id":"avatar-26","prompt":"¿Qué trabajo tiene Maxi al principio de la serie?","options":["Comercial","Conserje-jardinero","Conserje"],"correct_index":2},{"id":"duel-26-4","avatar_id":"avatar-26","prompt":"¿Cómo se llama el bar que regentan Maxi y Enrique?","options":["Cafebrería Quiroga","Max & Henry","Mariscos Recio"],"correct_index":1},{"id":"duel-27-3","avatar_id":"avatar-27","prompt":"¿Con quién viaja Leo cuando sufre un accidente de paracaídas?","options":["Goya Gutiérrez","Alba Recio","Noelia Balmaseda"],"correct_index":1},{"id":"duel-27-1","avatar_id":"avatar-27","prompt":"¿Quién interpreta a Leo en la serie?","options":["Ernesto Sevilla","Luis Miguel Seguí","Adrià Collado"],"correct_index":1},{"id":"duel-27-4","avatar_id":"avatar-27","prompt":"¿Qué actividad provoca el accidente mortal de Leo?","options":["Esquí","Submarinismo","Paracaidismo"],"correct_index":2},{"id":"duel-27-2","avatar_id":"avatar-27","prompt":"¿Qué apellido tiene Leo?","options":["Carrascosa","Calatrava","Romaní"],"correct_index":2},{"id":"duel-27-5","avatar_id":"avatar-27","prompt":"¿Qué Cuqui llora y dedica unas palabras a Leo en su despedida?","options":["Amador Rivas","Leo Romaní","Bruno Quiroga"],"correct_index":0},{"id":"duel-28-2","avatar_id":"avatar-28","prompt":"¿Quién es el padre de Alba?","options":["Vicente Maroto","Antonio Recio","Amador Rivas"],"correct_index":1},{"id":"duel-28-1","avatar_id":"avatar-28","prompt":"¿Quién interpreta a Alba en la serie?","options":["Ricardo Arroyo","Víctor Palmero","José Luis Gil"],"correct_index":1},{"id":"duel-28-5","avatar_id":"avatar-28","prompt":"¿Qué apellido tiene Alba?","options":["Trujillo","Palomares","Recio"],"correct_index":2},{"id":"duel-28-4","avatar_id":"avatar-28","prompt":"¿Qué hermano de Amador mantiene una relación con Alba?","options":["Fran","Teodoro Rivas","Minguito"],"correct_index":1},{"id":"duel-28-3","avatar_id":"avatar-28","prompt":"¿Quién es la madre de Alba?","options":["Berta Escobar","Estela Reynolds","Justi"],"correct_index":0}]$questions$::jsonb) as q(id text,avatar_id text,prompt text,options jsonb,correct_index integer)
on conflict(id) do update set avatar_id=excluded.avatar_id,prompt=excluded.prompt,options=excluded.options,correct_index=excluded.correct_index;

-- ARCHIVO: 008_duel_rewards.sql
-- Ejecutar después de 007_duels.sql y 007_duel_question_seed.sql.
-- Premios: puntos obtenidos al ranking; 50/10/25 monedas por victoria/derrota/empate.

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


-- ARCHIVO: 009_duel_fast_advance.sql
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


-- ARCHIVO: 010_daily_ads_rewards.sql
-- Daily: anuncio intersticial y canje X2 de monedas tras el vídeo. Ejecutar en Supabase.
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
notify pgrst, 'reload schema';

commit;

-- ARCHIVO: 012_store_video.sql
-- La tienda ofrece solo el vídeo; mantiene compras antiguas guardadas.
begin;
alter table public.quiz_lqsa_store_purchases
 drop constraint if exists quiz_lqsa_store_purchases_item_id_check;
alter table public.quiz_lqsa_store_purchases
 add constraint quiz_lqsa_store_purchases_item_id_check
 check(item_id in('stickers-portal','stickers-comic','wallpaper-portal','wallpaper-night','wallpaper-cream','video-bloopers'));
create or replace function public.quiz_lqsa_buy_store_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid();v_price integer;v_balance bigint;
begin
 if v_user is null then raise exception 'authentication_required';end if;
 v_price:=case p_item_id when 'video-bloopers' then 300 else null end;
 if v_price is null then raise exception 'store_item_invalid';end if;
 select coins into v_balance from public.quiz_lqsa_stats where user_id=v_user for update;
 if not found then raise exception 'store_profile_missing';end if;
 if exists(select 1 from public.quiz_lqsa_store_purchases where user_id=v_user and item_id=p_item_id) then
  return jsonb_build_object('status','already_owned','item_id',p_item_id,'coins',v_balance);
 end if;
 if v_balance<v_price then raise exception 'insufficient_coins';end if;
 insert into public.quiz_lqsa_store_purchases(user_id,item_id,coins_paid) values(v_user,p_item_id,v_price);
 update public.quiz_lqsa_stats set coins=coins-v_price,updated_at=now() where user_id=v_user returning coins into v_balance;
 return jsonb_build_object('status','purchased','item_id',p_item_id,'price',v_price,'coins',v_balance);
end;$$;
revoke all on function public.quiz_lqsa_buy_store_item(text) from public,anon;
grant execute on function public.quiz_lqsa_buy_store_item(text) to authenticated;
notify pgrst,'reload schema';
commit;
