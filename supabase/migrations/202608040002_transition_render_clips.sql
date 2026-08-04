-- Store the four operator-only Runway Turbo bridge clips used between the five
-- customer-approved story clips. They intentionally have no source still: the
-- bridge illustration is generated only after still approval and never enters
-- the customer's still-review set.

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check check (category in (
  'source_image', 'source_video', 'scene_still', 'render_clip',
  'transition_clip', 'assembled_film', 'review_video', 'final_video', 'thumbnail'
));

create unique index if not exists assets_transition_clip_slot_idx
  on public.assets(order_id, scene_sort_order) where category = 'transition_clip';

create or replace function public.enforce_video_asset_consents()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.category in ('render_clip', 'transition_clip', 'assembled_film', 'review_video', 'final_video')
     and not public.order_has_current_consents(new.order_id) then
    raise exception 'current photo, people, minor and external service consent records are required before video processing';
  end if;
  return new;
end;
$$;

create or replace function public.admin_register_transition_clip(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_transition_sort_order integer
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_asset_id uuid;
  v_approved_still_count integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm') then raise exception 'invalid video mime type'; end if;
  if p_file_size <= 0 or p_file_size > 209715200 then raise exception 'invalid video file size'; end if;
  if p_transition_sort_order < 0 or p_transition_sort_order > 3 then raise exception 'invalid transition slot'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('production', 'revision_requested') then raise exception 'transition clip cannot be uploaded in current status'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before rendering'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before rendering'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before rendering';
  end if;
  if v_order.stills_approved_at is null then raise exception 'customer stills approval required before rendering'; end if;
  if p_storage_path not like 'admin/' || v_order.id::text || '/%' then raise exception 'invalid storage path'; end if;

  select count(*) into v_approved_still_count
  from public.assets
  where order_id = p_order_id
    and category = 'scene_still'
    and id = any(coalesce(v_order.stills_approved_asset_ids, array[]::uuid[]));
  if v_approved_still_count <> 5 then raise exception 'five approved story pages are required'; end if;

  if exists (
    select 1 from public.assets
    where order_id = p_order_id
      and category = 'transition_clip'
      and scene_sort_order = p_transition_sort_order
  ) then
    raise exception 'transition slot already has a clip';
  end if;

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename, mime_type,
    file_size, scene_title, scene_sort_order
  )
  values (
    p_order_id, v_order.user_id, 'transition_clip', p_storage_path,
    p_original_filename, p_mime_type, p_file_size,
    'Transition ' || (p_transition_sort_order + 1)::text || '→' || (p_transition_sort_order + 2)::text,
    p_transition_sort_order
  )
  returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'transition_clip_uploaded',
    jsonb_build_object(
      'asset_id', v_asset_id,
      'transition_sort_order', p_transition_sort_order,
      'filename', p_original_filename
    )
  );
  return v_asset_id;
end;
$$;

create or replace function public.admin_delete_transition_clip(p_asset_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_asset public.assets%rowtype;
  v_order_status text;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset not found'; end if;
  if v_asset.category <> 'transition_clip' then raise exception 'asset is not a transition clip'; end if;

  select status into v_order_status from public.orders where id = v_asset.order_id for update;
  if v_order_status not in ('production', 'revision_requested') then
    raise exception 'transition clip cannot be removed in current status';
  end if;

  delete from public.assets where id = p_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    v_asset.order_id,
    auth.uid(),
    'transition_clip_deleted',
    jsonb_build_object(
      'asset_id', p_asset_id,
      'transition_sort_order', v_asset.scene_sort_order,
      'filename', v_asset.original_filename
    )
  );
  return v_asset.storage_path;
end;
$$;

revoke all on function public.admin_register_transition_clip(uuid, text, text, text, bigint, integer) from public, anon;
revoke all on function public.admin_delete_transition_clip(uuid) from public, anon;
grant execute on function public.admin_register_transition_clip(uuid, text, text, text, bigint, integer) to authenticated;
grant execute on function public.admin_delete_transition_clip(uuid) to authenticated;
