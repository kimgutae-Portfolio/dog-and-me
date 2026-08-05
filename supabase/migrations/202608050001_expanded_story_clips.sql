-- Expand exactly three of the five approved story pages into two Runway clips.
-- The selected story slots live on the order so the production export, upload
-- UI and local assembler always agree on the same eight-clip structure.

alter table public.orders
  add column if not exists expanded_story_sort_orders integer[] not null default '{}';

alter table public.orders
  drop constraint if exists orders_expanded_story_sort_orders_check,
  add constraint orders_expanded_story_sort_orders_check check (
    cardinality(expanded_story_sort_orders) in (0, 3)
    and expanded_story_sort_orders <@ array[0, 1, 2, 3, 4]
  );

alter table public.assets
  add column if not exists render_take smallint not null default 1;

alter table public.assets
  drop constraint if exists assets_render_take_check,
  add constraint assets_render_take_check check (
    (category = 'render_clip' and render_take in (1, 2))
    or (category <> 'render_clip' and render_take = 1)
  );

drop index if exists public.assets_render_clip_one_per_still_idx;
create unique index if not exists assets_render_clip_take_per_still_idx
  on public.assets(source_still_asset_id, render_take)
  where category = 'render_clip';

create or replace function public.admin_set_expanded_story_slots(
  p_order_id uuid,
  p_sort_orders integer[]
)
returns integer[]
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_normalized integer[];
  v_distinct_count integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('production', 'revision_requested') then
    raise exception 'expanded stories cannot be changed in current status';
  end if;
  if v_order.stills_approved_at is null then
    raise exception 'customer stills approval required';
  end if;

  select count(distinct value), array_agg(value order by value)
    into v_distinct_count, v_normalized
  from unnest(coalesce(p_sort_orders, array[]::integer[])) as value;

  if cardinality(coalesce(p_sort_orders, array[]::integer[])) <> 3
     or v_distinct_count <> 3
     or exists (
       select 1
       from unnest(p_sort_orders) as value
       where value < 0 or value > 4
     ) then
    raise exception 'exactly three distinct story slots from 0 to 4 are required';
  end if;

  if exists (
    select 1
    from public.assets
    where order_id = p_order_id
      and category = 'render_clip'
      and render_take = 2
      and not (scene_sort_order = any(v_normalized))
  ) then
    raise exception 'delete the second clip before removing its expanded story slot';
  end if;

  update public.orders
  set expanded_story_sort_orders = v_normalized
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'expanded_story_slots_updated',
    jsonb_build_object('story_sort_orders', v_normalized)
  );

  return v_normalized;
end;
$$;

create or replace function public.admin_register_story_render_clip(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_still_asset_id uuid,
  p_render_take smallint
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_still public.assets%rowtype;
  v_asset_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm') then raise exception 'invalid video mime type'; end if;
  if p_file_size <= 0 or p_file_size > 209715200 then raise exception 'invalid video file size'; end if;
  if p_render_take not in (1, 2) then raise exception 'invalid render take'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('production', 'revision_requested') then raise exception 'render clip cannot be uploaded in current status'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before rendering'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before rendering'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before rendering';
  end if;
  if v_order.stills_approved_at is null then raise exception 'customer stills approval required before rendering'; end if;
  if p_storage_path not like 'admin/' || v_order.id::text || '/%' then raise exception 'invalid storage path'; end if;

  select * into v_still from public.assets where id = p_still_asset_id;
  if not found then raise exception 'scene still not found'; end if;
  if v_still.order_id <> p_order_id or v_still.category <> 'scene_still' then
    raise exception 'scene still does not belong to this order';
  end if;
  if v_order.stills_approved_asset_ids is null
     or not (p_still_asset_id = any(v_order.stills_approved_asset_ids)) then
    raise exception 'render clip is not linked to an approved scene still';
  end if;
  if p_render_take = 2
     and not (v_still.scene_sort_order = any(v_order.expanded_story_sort_orders)) then
    raise exception 'this story is not selected for a second clip';
  end if;
  if exists (
    select 1 from public.assets
    where source_still_asset_id = p_still_asset_id
      and category = 'render_clip'
      and render_take = p_render_take
  ) then
    raise exception 'this story take already has a render clip';
  end if;

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename, mime_type,
    file_size, scene_title, scene_sort_order, source_still_asset_id, render_take
  )
  values (
    p_order_id, v_order.user_id, 'render_clip', p_storage_path,
    p_original_filename, p_mime_type, p_file_size, v_still.scene_title,
    v_still.scene_sort_order, p_still_asset_id, p_render_take
  )
  returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'render_clip_uploaded',
    jsonb_build_object(
      'asset_id', v_asset_id,
      'still_asset_id', p_still_asset_id,
      'scene_title', v_still.scene_title,
      'render_take', p_render_take,
      'filename', p_original_filename
    )
  );
  return v_asset_id;
end;
$$;

revoke all on function public.admin_set_expanded_story_slots(uuid, integer[]) from public, anon;
revoke all on function public.admin_register_story_render_clip(uuid, text, text, text, bigint, uuid, smallint) from public, anon;
grant execute on function public.admin_set_expanded_story_slots(uuid, integer[]) to authenticated;
grant execute on function public.admin_register_story_render_clip(uuid, text, text, text, bigint, uuid, smallint) to authenticated;
