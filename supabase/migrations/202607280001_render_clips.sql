-- Operator-side film assembly.
--
-- The operator uploads one Runway video clip per customer-approved scene still,
-- then the admin screen assembles them into a single film. The assembled film is
-- internal until the operator watches it and explicitly publishes it as the
-- customer review video.
--
-- ============================================================================
-- STORAGE PATH CONVENTION — DELIBERATE DEPARTURE, READ BEFORE COPYING
-- ============================================================================
-- Every other asset RPC in this codebase requires
--   p_storage_path like user_id || '/' || order_id || '/%'
-- because it proves customer-submitted content belongs to the submitting
-- customer.
--
-- Render clips and assembled films are OPERATOR work products, and they must NOT
-- be readable by the customer before the operator publishes them. The storage
-- policy order_assets_select grants a customer read access to their ENTIRE uid
-- folder:
--   (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
-- so anything written under user_id/order_id/ can be listed and signed by that
-- customer directly, bypassing the app — including an un-reviewed film.
--
-- Therefore these two categories live under a literal 'admin/' prefix:
--   admin/{order_id}/clips/render_clip-{uuid}.mp4
--   admin/{order_id}/render/assembled_film-{uuid}.mp4
-- The literal 'admin' can never equal a uuid, so the customer predicate never
-- matches. admin_promote_assembled_film is the ONLY way content moves from the
-- admin namespace into the customer-readable one.
--
-- If you copy an existing RPC as a template for a new operator-only asset,
-- do NOT reintroduce the user_id/order_id path check for it.
-- ============================================================================

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check check (category in (
  'source_image', 'source_video', 'scene_still', 'render_clip',
  'assembled_film', 'review_video', 'final_video', 'thumbnail'
));

-- A render clip is always derived from exactly one approved scene still.
-- on delete restrict stops admin_delete_scene_still from orphaning a clip.
alter table public.assets
  add column if not exists source_still_asset_id uuid references public.assets(id) on delete restrict;

alter table public.assets
  drop constraint if exists assets_source_still_scope_check,
  add constraint assets_source_still_scope_check check (
    source_still_asset_id is null or category = 'render_clip'
  );

create index if not exists assets_render_clip_idx
  on public.assets(order_id, scene_sort_order) where category = 'render_clip';

create unique index if not exists assets_render_clip_one_per_still_idx
  on public.assets(source_still_asset_id) where category = 'render_clip';

-- The consent trigger must cover the new video categories, and it must also fire
-- on the promote UPDATE (which changes category rather than inserting a row).
create or replace function public.enforce_video_asset_consents()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.category in ('render_clip', 'assembled_film', 'review_video', 'final_video')
     and not public.order_has_current_consents(new.order_id) then
    raise exception 'current photo, people, minor and external service consent records are required before video processing';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_video_asset_consents_trigger on public.assets;
create trigger enforce_video_asset_consents_trigger
before insert or update of category on public.assets
for each row execute function public.enforce_video_asset_consents();

-- ---------------------------------------------------------------------------
-- Register one Runway clip against an approved scene still.
--
-- The clip inherits scene_sort_order and scene_title from its still, so the
-- assembled film can never be ordered differently from the stills the customer
-- approved.
-- ---------------------------------------------------------------------------
create or replace function public.admin_register_render_clip(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_still_asset_id uuid
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

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('production', 'revision_requested') then raise exception 'render clip cannot be uploaded in current status'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before rendering'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before rendering'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before rendering';
  end if;
  if v_order.stills_approved_at is null then raise exception 'customer stills approval required before rendering'; end if;

  -- See the storage path note at the top of this file.
  if p_storage_path not like 'admin/' || v_order.id::text || '/%' then raise exception 'invalid storage path'; end if;

  select * into v_still from public.assets where id = p_still_asset_id;
  if not found then raise exception 'scene still not found'; end if;
  if v_still.order_id <> p_order_id or v_still.category <> 'scene_still' then
    raise exception 'scene still does not belong to this order';
  end if;
  -- The assembled film may only contain footage derived from stills the customer
  -- actually approved. stills_approved_asset_ids is recorded for exactly this.
  if v_order.stills_approved_asset_ids is null
     or not (p_still_asset_id = any(v_order.stills_approved_asset_ids)) then
    raise exception 'render clip is not linked to an approved scene still';
  end if;
  if exists (
    select 1 from public.assets
    where source_still_asset_id = p_still_asset_id and category = 'render_clip'
  ) then
    raise exception 'scene still already has a render clip';
  end if;

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename, mime_type, file_size,
    scene_title, scene_sort_order, source_still_asset_id
  )
  values (
    p_order_id, v_order.user_id, 'render_clip', p_storage_path, p_original_filename, p_mime_type, p_file_size,
    v_still.scene_title, v_still.scene_sort_order, p_still_asset_id
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
      'filename', p_original_filename
    )
  );
  return v_asset_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete a render clip. Returns the storage path so the caller can remove the
-- object (DB row is the source of truth, storage cleanup is best-effort).
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_render_clip(p_asset_id uuid)
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
  if v_asset.category <> 'render_clip' then raise exception 'asset is not a render clip'; end if;

  select status into v_order_status from public.orders where id = v_asset.order_id for update;
  if v_order_status not in ('production', 'revision_requested') then
    raise exception 'render clip cannot be removed in current status';
  end if;

  delete from public.assets where id = p_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    v_asset.order_id,
    auth.uid(),
    'render_clip_deleted',
    jsonb_build_object('asset_id', p_asset_id, 'filename', v_asset.original_filename)
  );
  return v_asset.storage_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Register the assembled film. Internal only — this does NOT change order
-- status and the customer cannot see it. admin_promote_assembled_film is the
-- deliberate second step.
-- ---------------------------------------------------------------------------
create or replace function public.admin_register_assembled_film(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_duration_seconds numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_asset_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_mime_type <> 'video/mp4' then raise exception 'invalid video mime type'; end if;
  if p_file_size <= 0 or p_file_size > 209715200 then raise exception 'invalid video file size'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('production', 'revision_requested') then raise exception 'assembled film cannot be registered in current status'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before rendering'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before rendering'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before rendering';
  end if;
  if v_order.stills_approved_at is null then raise exception 'customer stills approval required before rendering'; end if;

  -- See the storage path note at the top of this file.
  if p_storage_path not like 'admin/' || v_order.id::text || '/%' then raise exception 'invalid storage path'; end if;

  insert into public.assets(order_id, user_id, category, storage_path, original_filename, mime_type, file_size)
  values (p_order_id, v_order.user_id, 'assembled_film', p_storage_path, p_original_filename, p_mime_type, p_file_size)
  returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'assembled_film_registered',
    jsonb_build_object(
      'asset_id', v_asset_id,
      'filename', p_original_filename,
      'file_size', p_file_size,
      'duration_seconds', p_duration_seconds
    )
  );
  return v_asset_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publish an assembled film as the customer review video.
--
-- Repeats admin_register_video_asset's review_video gates rather than calling
-- it, because this path re-categorises an existing row instead of inserting a
-- new one. The caller must storage.move() the object to p_storage_path first,
-- and move it back if this function raises.
-- ---------------------------------------------------------------------------
create or replace function public.admin_promote_assembled_film(
  p_asset_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_asset public.assets%rowtype;
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'asset not found'; end if;
  if v_asset.category <> 'assembled_film' then raise exception 'asset is not an assembled film'; end if;

  select * into v_order from public.orders where id = v_asset.order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('production', 'revision_requested', 'customer_review') then
    raise exception 'review video cannot be published in current status';
  end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before video production'; end if;
  if not public.order_has_current_consents(v_order.id) then raise exception 'current consent record required before video production'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before video production';
  end if;

  -- Now it must live in the customer-readable namespace.
  if p_storage_path not like v_order.user_id::text || '/' || v_order.id::text || '/%' then
    raise exception 'invalid storage path';
  end if;

  update public.assets
  set category = 'review_video',
      storage_path = p_storage_path
  where id = p_asset_id;

  update public.orders
  set status = 'customer_review',
      customer_approved_at = null,
      customer_approved_by = null,
      customer_approved_review_asset_id = null,
      stage_updated_at = now()
  where id = v_order.id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    v_order.id,
    auth.uid(),
    'assembled_film_promoted',
    jsonb_build_object('asset_id', p_asset_id, 'storage_path', p_storage_path)
  );
end;
$$;

revoke all on function public.admin_register_render_clip(uuid, text, text, text, bigint, uuid) from public, anon;
revoke all on function public.admin_delete_render_clip(uuid) from public, anon;
revoke all on function public.admin_register_assembled_film(uuid, text, text, text, bigint, numeric) from public, anon;
revoke all on function public.admin_promote_assembled_film(uuid, text) from public, anon;
grant execute on function public.admin_register_render_clip(uuid, text, text, text, bigint, uuid) to authenticated;
grant execute on function public.admin_delete_render_clip(uuid) to authenticated;
grant execute on function public.admin_register_assembled_film(uuid, text, text, text, bigint, numeric) to authenticated;
grant execute on function public.admin_promote_assembled_film(uuid, text) to authenticated;
