-- Tienda Quiz LQSA. Ejecutar una vez después de la base 001-003.
begin;

create table if not exists public.quiz_lqsa_store_purchases(
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null check(item_id in('stickers-portal','stickers-comic','wallpaper-portal','wallpaper-night','wallpaper-cream','video-bloopers')),
 coins_paid integer not null check(coins_paid>0),
 purchased_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
alter table public.quiz_lqsa_store_purchases enable row level security;
revoke all on public.quiz_lqsa_store_purchases from public,anon,authenticated;
grant select on public.quiz_lqsa_store_purchases to authenticated;
drop policy if exists quiz_lqsa_store_own_purchases on public.quiz_lqsa_store_purchases;
create policy quiz_lqsa_store_own_purchases on public.quiz_lqsa_store_purchases
 for select to authenticated using(user_id=auth.uid());

create or replace function public.quiz_lqsa_buy_store_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
 v_user uuid:=auth.uid();
 v_price integer;
 v_balance bigint;
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
