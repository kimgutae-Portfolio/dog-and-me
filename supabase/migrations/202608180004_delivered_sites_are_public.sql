-- A personal site has one publication rule: a delivered order is public.
-- Keep the legacy token/active columns for old URLs and clients, but never use
-- them as an additional publication gate.

create or replace function public.delivered_memory_for_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.deliveries%rowtype;
  v_concept public.concepts%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and status = 'delivered';
  if not found then return null; end if;

  select * into v_delivery
  from public.deliveries
  where order_id = v_order.id;
  if not found then return null; end if;

  select * into v_concept
  from public.concepts
  where order_id = v_order.id
    and status = 'published'
    and slot = v_order.selected_concept_slot
  limit 1;

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
      'video_storage_path', (
        select storage_path from public.assets where id = v_delivery.final_asset_id
      )
    ),
    'concept', case when v_concept.id is null then null else jsonb_build_object(
      'title', v_concept.title,
      'tone', v_concept.tone,
      'summary', v_concept.summary,
      'scenes', v_concept.scenes
    ) end,
    'images', public.album_page_for_order(v_order.id, 0, 30),
    'album_total', public.album_count_for_order(v_order.id),
    'character', (
      select jsonb_build_object('storage_path', asset.storage_path)
      from public.assets asset
      where asset.order_id = v_order.id
        and asset.category = 'character_sprite'
      limit 1
    )
  );
end;
$$;

create or replace function public.get_shared_memory(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.delivered_memory_for_order(link.order_id)
  from public.share_links as link
  join public.orders as orders on orders.id = link.order_id
  where link.token = p_token
    and orders.status = 'delivered'
  limit 1;
$$;

create or replace function public.get_shared_memory_by_slug(
  p_customer_slug text,
  p_pet_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.delivered_memory_for_order(link.order_id)
  from public.share_links as link
  join public.orders as orders on orders.id = link.order_id
  where link.customer_slug = lower(p_customer_slug)
    and link.pet_slug = lower(p_pet_slug)
    and orders.status = 'delivered'
  limit 1;
$$;

create or replace function public.get_shared_album_page_by_code(
  p_share_code text,
  p_offset integer,
  p_limit integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.album_page_for_order(link.order_id, p_offset, p_limit)
  from public.share_links as link
  join public.orders as orders on orders.id = link.order_id
  where link.token = p_share_code
    and orders.status = 'delivered'
  limit 1;
$$;

create or replace function public.get_shared_album_page_by_slug(
  p_customer_slug text,
  p_pet_slug text,
  p_offset integer,
  p_limit integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.album_page_for_order(link.order_id, p_offset, p_limit)
  from public.share_links as link
  join public.orders as orders on orders.id = link.order_id
  where link.customer_slug = lower(p_customer_slug)
    and link.pet_slug = lower(p_pet_slug)
    and orders.status = 'delivered'
  limit 1;
$$;

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
    join public.share_links as link on link.order_id = asset.order_id
    join public.orders as orders
      on orders.id = asset.order_id and orders.status = 'delivered'
    left join public.deliveries as delivery on delivery.order_id = asset.order_id
    where asset.storage_path = p_storage_path
      and (
        (asset.category = 'source_image' and asset.album_visible)
        or asset.category in ('scene_still', 'album_photo', 'character_sprite')
        or (asset.category = 'final_video' and delivery.final_asset_id = asset.id)
      )
  );
$$;

revoke all on function public.delivered_memory_for_order(uuid) from public, anon, authenticated;
revoke all on function public.get_shared_memory(text) from public;
revoke all on function public.get_shared_memory_by_slug(text, text) from public;
revoke all on function public.get_shared_album_page_by_code(text, integer, integer) from public;
revoke all on function public.get_shared_album_page_by_slug(text, text, integer, integer) from public;
revoke all on function public.can_read_shared_asset(text) from public;

grant execute on function public.get_shared_memory(text) to anon, authenticated;
grant execute on function public.get_shared_memory_by_slug(text, text) to anon, authenticated;
grant execute on function public.get_shared_album_page_by_code(text, integer, integer) to anon, authenticated;
grant execute on function public.get_shared_album_page_by_slug(text, text, integer, integer) to anon, authenticated;
grant execute on function public.can_read_shared_asset(text) to anon, authenticated;
