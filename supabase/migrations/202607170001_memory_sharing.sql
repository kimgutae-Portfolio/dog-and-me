-- 家族共有リンクと、最大30枚のメモリーアルバム

alter table public.assets
  add column if not exists album_visible boolean not null default false,
  add column if not exists album_caption text,
  add column if not exists album_sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (partition by order_id order by created_at, id) - 1 as sort_order
  from public.assets
  where category = 'source_image'
)
update public.assets as asset
set
  album_sort_order = ranked.sort_order,
  album_visible = ranked.sort_order < 6
from ranked
where asset.id = ranked.id;

create index if not exists assets_album_idx
on public.assets(order_id, album_visible, album_sort_order)
where category = 'source_image';

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists share_links_token_active_idx
on public.share_links(token)
where active;

drop trigger if exists share_links_set_updated_at on public.share_links;
create trigger share_links_set_updated_at before update on public.share_links
for each row execute function public.set_updated_at();

alter table public.share_links enable row level security;

drop policy if exists share_links_select_own on public.share_links;
create policy share_links_select_own on public.share_links for select to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select on public.share_links to authenticated;

create or replace function public.validate_album_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visible_count integer;
begin
  if new.category <> 'source_image' then
    new.album_visible := false;
    new.album_caption := null;
    return new;
  end if;

  new.album_caption := nullif(trim(coalesce(new.album_caption, '')), '');
  if char_length(coalesce(new.album_caption, '')) > 120 then
    raise exception 'album caption must be 120 characters or fewer';
  end if;

  if new.album_sort_order < 0 then
    new.album_sort_order := 0;
  end if;

  if new.album_visible and (tg_op = 'INSERT' or not coalesce(old.album_visible, false)) then
    select count(*) into v_visible_count
    from public.assets
    where order_id = new.order_id
      and category = 'source_image'
      and album_visible
      and id <> new.id;

    if v_visible_count >= 30 then
      raise exception 'memory album can contain up to 30 visible photos';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists assets_validate_album on public.assets;
create trigger assets_validate_album before insert or update of album_visible, album_caption, album_sort_order
on public.assets for each row execute function public.validate_album_asset();

drop policy if exists assets_update_album_own on public.assets;
create policy assets_update_album_own on public.assets for update to authenticated
using ((user_id = auth.uid() or public.is_admin()) and category = 'source_image')
with check ((user_id = auth.uid() or public.is_admin()) and category = 'source_image');

grant update (album_visible, album_caption, album_sort_order) on public.assets to authenticated;

create or replace function public.manage_memory_share(
  p_order_id uuid,
  p_action text default 'get'
)
returns table(token text, active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select user_id into v_owner_id from public.orders where id = p_order_id;

  if v_owner_id is null or (v_owner_id <> auth.uid() and not public.is_admin()) then
    raise exception 'not allowed';
  end if;

  insert into public.share_links (order_id, user_id)
  values (p_order_id, v_owner_id)
  on conflict (order_id) do nothing;

  if p_action = 'enable' then
    update public.share_links set active = true where order_id = p_order_id;
  elsif p_action = 'disable' then
    update public.share_links set active = false where order_id = p_order_id;
  elsif p_action = 'rotate' then
    update public.share_links
    set token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        active = true
    where order_id = p_order_id;
  elsif p_action <> 'get' then
    raise exception 'invalid action';
  end if;

  return query
  select link.token, link.active
  from public.share_links as link
  where link.order_id = p_order_id;
end;
$$;

revoke all on function public.manage_memory_share(uuid, text) from public;
grant execute on function public.manage_memory_share(uuid, text) to authenticated;

create or replace function public.get_shared_memory(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.deliveries%rowtype;
  v_concept public.concepts%rowtype;
  v_assets jsonb;
begin
  select orders.* into v_order
  from public.share_links
  join public.orders on orders.id = share_links.order_id
  where share_links.token = p_token
    and share_links.active
    and orders.status = 'delivered';

  if not found then
    return null;
  end if;

  select * into v_delivery
  from public.deliveries
  where order_id = v_order.id;

  if not found then
    return null;
  end if;

  select * into v_concept
  from public.concepts
  where order_id = v_order.id
    and status = 'published'
    and slot = v_order.selected_concept_slot
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', asset.id,
    'storage_path', asset.storage_path,
    'caption', asset.album_caption,
    'sort_order', asset.album_sort_order
  ) order by asset.album_sort_order, asset.created_at), '[]'::jsonb)
  into v_assets
  from public.assets as asset
  where asset.order_id = v_order.id
    and asset.category = 'source_image'
    and asset.album_visible
  limit 30;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'pet_name', v_order.pet_name,
      'breed', v_order.breed,
      'purpose', v_order.purpose,
      'message_to_pet', v_order.message_to_pet,
      'created_at', v_order.created_at
    ),
    'delivery', jsonb_build_object(
      'title', v_delivery.title,
      'customer_message', v_delivery.customer_message,
      'video_storage_path', (select storage_path from public.assets where id = v_delivery.final_asset_id)
    ),
    'concept', case when v_concept.id is null then null else jsonb_build_object(
      'title', v_concept.title,
      'tone', v_concept.tone,
      'summary', v_concept.summary,
      'scenes', v_concept.scenes
    ) end,
    'images', v_assets
  );
end;
$$;

revoke all on function public.get_shared_memory(text) from public;
grant execute on function public.get_shared_memory(text) to anon, authenticated;

create or replace function public.can_read_shared_asset(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assets as asset
    join public.share_links as link on link.order_id = asset.order_id and link.active
    left join public.deliveries as delivery on delivery.order_id = asset.order_id
    where asset.storage_path = p_storage_path
      and (
        (asset.category = 'source_image' and asset.album_visible)
        or (asset.category = 'final_video' and delivery.final_asset_id = asset.id)
      )
  );
$$;

revoke all on function public.can_read_shared_asset(text) from public;
grant execute on function public.can_read_shared_asset(text) to anon, authenticated;

drop policy if exists order_assets_public_shared_select on storage.objects;
create policy order_assets_public_shared_select on storage.objects for select to anon, authenticated
using (
  bucket_id = 'order-assets'
  and public.can_read_shared_asset(name)
);
