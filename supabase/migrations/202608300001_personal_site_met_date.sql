-- Customers can add the day they first met their dog after delivery. The
-- public personal site uses it to render an automatically updating D-day.

alter table public.orders
  add column if not exists met_on date;

create or replace function public.set_personal_site_met_on(
  p_order_id uuid,
  p_met_on date
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found or (v_order.user_id <> auth.uid() and not public.is_admin()) then
    raise exception 'order not found';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'delivery required';
  end if;
  if p_met_on is not null and p_met_on > current_date then
    raise exception 'met date cannot be in the future';
  end if;

  update public.orders
  set met_on = p_met_on,
      updated_at = now()
  where id = p_order_id;

  return p_met_on;
end;
$$;

revoke all on function public.set_personal_site_met_on(uuid, date) from public, anon;
grant execute on function public.set_personal_site_met_on(uuid, date) to authenticated;

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
      'met_on', v_order.met_on,
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

revoke all on function public.delivered_memory_for_order(uuid) from public, anon, authenticated;
