-- Quiz LQSA: comprobación y exclusividad del alias, sin distinguir mayúsculas.
-- Si ya existen alias duplicados, se detiene sin modificar usuarios ni saldos.
begin;
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
commit;
