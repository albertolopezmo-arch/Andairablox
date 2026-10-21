-- Preparado para un futuro proyecto NUEVO de Supabase. No ejecutar en las otras apps.
begin;
create table if not exists public.quiz_lqsa_stats (
 user_id uuid primary key references auth.users(id) on delete cascade,
 points bigint not null default 0 check (points >= 0),
 coins bigint not null default 0 check (coins >= 0),
 updated_at timestamptz not null default now()
);
alter table public.quiz_lqsa_stats enable row level security;
revoke all on public.quiz_lqsa_stats from anon,authenticated;
grant select on public.quiz_lqsa_stats to authenticated;
drop policy if exists quiz_lqsa_own_stats on public.quiz_lqsa_stats;
create policy quiz_lqsa_own_stats on public.quiz_lqsa_stats for select to authenticated using (user_id=auth.uid());
-- Premios y compras se implementarán en funciones de servidor; el cliente no modifica saldos.
create or replace function public.quiz_lqsa_new_user() returns trigger
language plpgsql security definer set search_path=pg_catalog, public as $$
begin insert into public.quiz_lqsa_stats(user_id) values(new.id) on conflict do nothing;return new;end;
$$;
revoke all on function public.quiz_lqsa_new_user() from public,anon,authenticated;
drop trigger if exists quiz_lqsa_new_user on auth.users;
create trigger quiz_lqsa_new_user after insert on auth.users for each row execute function public.quiz_lqsa_new_user();
commit;
