-- Consent gate alignment: route every production gate through the canonical
-- helper instead of hardcoded policy version strings.
--
-- 202607270002 bumped the current policy versions to '2026-07-27' (and the
-- photo-rights / people-policy texts to their v2 values) inside
-- public.order_has_current_consents(uuid), but three functions still compared
-- against the retired '2026-07-21' literals:
--   * admin_register_video_asset  (blocked every review/final video upload)
--   * admin_update_order          (blocked every transition into production)
--   * customer_approve_review     (blocked every customer approval)
-- Any order carrying a current consent record therefore failed the check.
-- These definitions are byte-identical to the previous ones apart from the
-- consent block, which now delegates to order_has_current_consents so future
-- version bumps only have to touch one place.

-- 1. admin_register_video_asset -------------------------------------------

create or replace function public.admin_register_video_asset(
  p_order_id uuid,
  p_category text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint
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
  if p_category not in ('review_video', 'final_video') then raise exception 'invalid video category'; end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm') then raise exception 'invalid video mime type'; end if;
  if p_file_size <= 0 or p_file_size > 209715200 then raise exception 'invalid video file size'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before video production'; end if;
  if not public.order_has_current_consents(p_order_id) then
    raise exception 'current consent record required before video production';
  end if;
  if p_storage_path not like v_order.user_id::text || '/' || v_order.id::text || '/%' then raise exception 'invalid storage path'; end if;

  if p_category = 'review_video' and v_order.status not in ('production', 'revision_requested', 'customer_review') then
    raise exception 'review video cannot be uploaded in current status';
  end if;
  if p_category = 'final_video' then
    if v_order.status <> 'quality_check' then raise exception 'final video requires quality_check status'; end if;
    if v_order.customer_approved_at is null or v_order.customer_approved_review_asset_id is null then
      raise exception 'customer approval required before final video';
    end if;
    if exists (select 1 from public.revision_requests where order_id = p_order_id and status = 'open') then
      raise exception 'open revision must be resolved before final video';
    end if;
  end if;

  insert into public.assets(order_id, user_id, category, storage_path, original_filename, mime_type, file_size)
  values (p_order_id, v_order.user_id, p_category, p_storage_path, p_original_filename, p_mime_type, p_file_size)
  returning id into v_asset_id;

  if p_category = 'review_video' then
    update public.orders
    set status = 'customer_review',
        customer_approved_at = null,
        customer_approved_by = null,
        customer_approved_review_asset_id = null,
        stage_updated_at = now()
    where id = p_order_id;
  end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    case when p_category = 'review_video' then 'review_video_uploaded' else 'final_video_uploaded' end,
    jsonb_build_object('asset_id', v_asset_id, 'filename', p_original_filename, 'file_size', p_file_size)
  );
  return v_asset_id;
end;
$$;

-- 2. admin_update_order ----------------------------------------------------

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status text,
  p_payment_status text,
  p_due_date date,
  p_admin_notes text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_before from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not public.is_valid_order_transition(v_before.status, p_status) then
    raise exception 'invalid order status transition: % -> %', v_before.status, p_status;
  end if;
  if p_payment_status not in ('pending', 'invoice_sent', 'paid', 'refunded') then raise exception 'invalid payment status'; end if;

  if p_status in ('stills_review', 'production', 'customer_review', 'revision_requested', 'quality_check') and p_payment_status <> 'paid' then
    raise exception 'payment must be confirmed before production';
  end if;
  if p_status in ('stills_review', 'production', 'customer_review', 'revision_requested', 'quality_check')
     and not public.order_has_current_consents(p_order_id) then
    raise exception 'current consent record required before production';
  end if;
  if p_status = 'quality_check' and exists (
    select 1 from public.revision_requests where order_id = p_order_id and status = 'open'
  ) then raise exception 'open revision must be resolved'; end if;

  update public.orders
  set status = p_status,
      payment_status = p_payment_status,
      due_date = p_due_date,
      admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
      customer_approved_at = case when status = 'quality_check' and p_status <> 'quality_check' then null else customer_approved_at end,
      customer_approved_by = case when status = 'quality_check' and p_status <> 'quality_check' then null else customer_approved_by end,
      customer_approved_review_asset_id = case when status = 'quality_check' and p_status <> 'quality_check' then null else customer_approved_review_asset_id end,
      stills_approved_at = case when status = 'stills_review' and p_status = 'concept_selected' then null else stills_approved_at end,
      stills_approved_by = case when status = 'stills_review' and p_status = 'concept_selected' then null else stills_approved_by end,
      stage_updated_at = case when status is distinct from p_status then now() else stage_updated_at end
  where id = p_order_id;

  if v_before.status is distinct from p_status
     or v_before.payment_status is distinct from p_payment_status
     or v_before.due_date is distinct from p_due_date
     or v_before.admin_notes is distinct from nullif(trim(coalesce(p_admin_notes, '')), '') then
    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (
      p_order_id,
      auth.uid(),
      'admin_order_updated',
      jsonb_build_object(
        'before', jsonb_build_object('status', v_before.status, 'payment_status', v_before.payment_status, 'due_date', v_before.due_date),
        'after', jsonb_build_object('status', p_status, 'payment_status', p_payment_status, 'due_date', p_due_date),
        'admin_notes_changed', v_before.admin_notes is distinct from nullif(trim(coalesce(p_admin_notes, '')), '')
      )
    );
  end if;
end;
$$;

-- 3. customer_approve_review -----------------------------------------------

create or replace function public.customer_approve_review(p_order_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_review_asset_id uuid;
  v_approved_at timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found or v_order.status <> 'customer_review' then raise exception 'review approval unavailable'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before approval'; end if;
  if not public.order_has_current_consents(p_order_id) then
    raise exception 'current consent record required';
  end if;
  if exists (select 1 from public.revision_requests where order_id = p_order_id and status = 'open') then
    raise exception 'open revision must be resolved before approval';
  end if;

  select id into v_review_asset_id
  from public.assets
  where order_id = p_order_id and category = 'review_video'
  order by created_at desc, id desc
  limit 1;
  if v_review_asset_id is null then raise exception 'review video not found'; end if;

  update public.orders
  set status = 'quality_check',
      customer_approved_at = v_approved_at,
      customer_approved_by = auth.uid(),
      customer_approved_review_asset_id = v_review_asset_id,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'customer_review_approved',
    jsonb_build_object('review_asset_id', v_review_asset_id, 'approved_at', v_approved_at)
  );
  return v_approved_at;
end;
$$;

-- 4. Execution grants ------------------------------------------------------

revoke all on function public.admin_register_video_asset(uuid, text, text, text, text, bigint) from public, anon;
revoke all on function public.admin_update_order(uuid, text, text, date, text) from public, anon;
revoke all on function public.customer_approve_review(uuid) from public, anon;
grant execute on function public.admin_register_video_asset(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.admin_update_order(uuid, text, text, date, text) to authenticated;
grant execute on function public.customer_approve_review(uuid) to authenticated;
