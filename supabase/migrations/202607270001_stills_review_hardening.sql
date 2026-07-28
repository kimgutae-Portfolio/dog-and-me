-- Harden the customer scene-stills review.
-- A customer must never approve a still set while their adjustment request is
-- waiting for the operator. The approved asset IDs are saved as evidence.

alter table public.orders
  add column if not exists stills_change_open boolean not null default false,
  add column if not exists stills_review_version integer not null default 0,
  add column if not exists stills_approved_version integer,
  add column if not exists stills_approved_asset_ids uuid[];

alter table public.orders
  drop constraint if exists orders_stills_review_version_check,
  add constraint orders_stills_review_version_check check (
    stills_review_version >= 0
    and (stills_approved_version is null or stills_approved_version between 1 and stills_review_version)
  );

-- New orders must pass through customer scene-still approval. The old direct
-- concept_selected -> production route is no longer valid.
create or replace function public.is_valid_order_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('awaiting_materials', 'cancelled'),
    ('materials_submitted', 'reviewing_materials'),
    ('materials_submitted', 'cancelled'),
    ('reviewing_materials', 'cancelled'),
    ('concepts_ready', 'reviewing_materials'),
    ('concepts_ready', 'cancelled'),
    ('concept_selected', 'concepts_ready'),
    ('concept_selected', 'stills_review'),
    ('concept_selected', 'cancelled'),
    ('stills_review', 'concept_selected'),
    ('stills_review', 'cancelled'),
    ('production', 'concept_selected'),
    ('production', 'cancelled'),
    ('customer_review', 'production'),
    ('customer_review', 'cancelled'),
    ('revision_requested', 'production'),
    ('revision_requested', 'cancelled'),
    ('quality_check', 'production'),
    ('quality_check', 'customer_review'),
    ('quality_check', 'cancelled')
  );
$$;

create or replace function public.admin_publish_scene_stills(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_still_count integer;
  v_next_version integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'concept_selected' then raise exception 'scene stills can only be published from concept_selected'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before scene stills'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before scene stills'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then raise exception 'photo analysis approval required before scene stills'; end if;

  select count(*)::integer into v_still_count
  from public.assets
  where order_id = p_order_id and category = 'scene_still';
  if v_still_count = 0 then raise exception 'at least one scene still is required before publishing'; end if;

  v_next_version := v_order.stills_review_version + 1;
  update public.orders
  set status = 'stills_review',
      stills_change_open = false,
      stills_review_version = v_next_version,
      stills_approved_at = null,
      stills_approved_by = null,
      stills_approved_version = null,
      stills_approved_asset_ids = null,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'scene_stills_published', jsonb_build_object('still_count', v_still_count, 'stills_review_version', v_next_version));
end;
$$;

create or replace function public.admin_begin_stills_revision(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'stills_review' or not v_order.stills_change_open then raise exception 'no open stills change request'; end if;

  update public.orders
  set status = 'concept_selected',
      stills_approved_at = null,
      stills_approved_by = null,
      stills_approved_version = null,
      stills_approved_asset_ids = null,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'scene_stills_revision_started', jsonb_build_object('stills_review_version', v_order.stills_review_version));
end;
$$;

create or replace function public.admin_delete_scene_still(p_asset_id uuid)
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
  if not found then raise exception 'scene still not found'; end if;
  if v_asset.category <> 'scene_still' then raise exception 'asset is not a scene still'; end if;
  select status into v_order_status from public.orders where id = v_asset.order_id for update;
  if v_order_status <> 'concept_selected' then raise exception 'return the order to concept preparation before changing published scene stills'; end if;

  delete from public.assets where id = p_asset_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (v_asset.order_id, auth.uid(), 'scene_still_deleted', jsonb_build_object('asset_id', p_asset_id, 'scene_title', v_asset.scene_title, 'filename', v_asset.original_filename));
  return v_asset.storage_path;
end;
$$;

create or replace function public.customer_approve_scene_stills(p_order_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_still_count integer;
  v_still_ids uuid[];
  v_approved_at timestamptz := now();
begin
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found or v_order.status <> 'stills_review' then raise exception 'stills approval unavailable'; end if;
  if v_order.stills_change_open then raise exception 'open stills change request must be republished first'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before approval'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required'; end if;

  select count(*)::integer, array_agg(id order by scene_sort_order, created_at)
  into v_still_count, v_still_ids
  from public.assets
  where order_id = p_order_id and category = 'scene_still';
  if v_still_count = 0 then raise exception 'scene stills not found'; end if;

  update public.orders
  set status = 'production',
      stills_approved_at = v_approved_at,
      stills_approved_by = auth.uid(),
      stills_approved_version = v_order.stills_review_version,
      stills_approved_asset_ids = v_still_ids,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'scene_stills_approved', jsonb_build_object('still_count', v_still_count, 'approved_at', v_approved_at, 'stills_review_version', v_order.stills_review_version, 'approved_asset_ids', v_still_ids));
  return v_approved_at;
end;
$$;

create or replace function public.request_stills_change(p_order_id uuid, p_body text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_change_number integer;
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 3000 then raise exception 'stills change body required'; end if;
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found or v_order.status <> 'stills_review' then raise exception 'order not found or stills change unavailable'; end if;
  if v_order.stills_change_open then raise exception 'previous stills change request is still open'; end if;
  if v_order.stills_revision_used >= v_order.stills_revision_limit then raise exception 'stills revision limit reached'; end if;

  v_change_number := v_order.stills_revision_used + 1;
  insert into public.messages(order_id, sender_id, body)
  values (p_order_id, auth.uid(), '【場面イメージの調整依頼 ' || v_change_number || '回目/' || v_order.stills_revision_limit || '回】' || E'\n' || trim(p_body));

  update public.orders set stills_revision_used = v_change_number, stills_change_open = true where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'stills_change_requested', jsonb_build_object('stills_revision_number', v_change_number, 'stills_revision_limit', v_order.stills_revision_limit, 'stills_review_version', v_order.stills_review_version));
end;
$$;

revoke all on function public.admin_begin_stills_revision(uuid) from public, anon;
grant execute on function public.admin_begin_stills_revision(uuid) to authenticated;
