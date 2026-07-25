-- Scene stills customer approval stage + application form simplification.
--
-- Pipeline change: production now generates scene STILL images first
-- (reference photos + episode text), shares them with the customer for
-- approval, and only then animates them into video.
--   concept_selected -> stills_review -> production
-- stills_review -> production is customer-approval-only (RPC), mirroring
-- the customer_review -> quality_check precedent.
--
-- Form simplification: all three reference photos (face/body/side-tail)
-- become required; per-memory photo links become optional (0-5); the
-- minimum total photo requirement drops to the three references.

-- 1. Constraints & columns -------------------------------------------------

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'awaiting_materials', 'materials_submitted', 'reviewing_materials',
  'concepts_ready', 'concept_selected', 'stills_review', 'production',
  'customer_review', 'revision_requested', 'quality_check', 'delivered', 'cancelled'
));

alter table public.orders
  add column if not exists stills_revision_limit integer not null default 2,
  add column if not exists stills_revision_used integer not null default 0,
  add column if not exists stills_approved_at timestamptz,
  add column if not exists stills_approved_by uuid references public.profiles(id) on delete set null;

alter table public.orders
  drop constraint if exists orders_stills_revision_check,
  add constraint orders_stills_revision_check check (
    stills_revision_limit >= 0 and stills_revision_used >= 0
    and stills_revision_used <= stills_revision_limit
  );

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check check (category in (
  'source_image', 'source_video', 'scene_still', 'review_video', 'final_video', 'thumbnail'
));

alter table public.assets
  add column if not exists scene_title text,
  add column if not exists scene_sort_order integer not null default 0;

alter table public.assets
  drop constraint if exists assets_scene_title_check,
  add constraint assets_scene_title_check check (
    scene_title is null or char_length(trim(scene_title)) between 1 and 80
  );

-- 2. Transition function ---------------------------------------------------
-- stills_review -> production is intentionally absent: only the customer
-- approval RPC advances past the stills review, just like
-- customer_review -> quality_check. concept_selected -> production stays
-- available for legacy orders sold under the old flow.

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
    ('concept_selected', 'production'),
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

-- 3. Photo-analysis gate now also covers stills_review ---------------------

create or replace function public.enforce_photo_analysis_before_production()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('concepts_ready', 'concept_selected', 'stills_review', 'production', 'customer_review', 'revision_requested', 'quality_check', 'delivered')
     and coalesce(new.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception '사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.';
  end if;
  return new;
end;
$$;

-- 4. admin_update_order: paid/consent gates include stills_review,
--    rollback stills_review -> concept_selected clears stills approval ----

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
     and (v_before.consented_at is null or v_before.external_ai_consent_at is null
       or v_before.terms_version is distinct from '2026-07-21'
       or v_before.privacy_version is distinct from '2026-07-21'
       or v_before.ai_notice_version is distinct from '2026-07-21') then
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

-- 5. Scene still RPCs ------------------------------------------------------

create or replace function public.admin_register_scene_still(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_scene_title text,
  p_scene_sort_order integer
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
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'invalid still image mime type'; end if;
  if p_file_size <= 0 or p_file_size > 52428800 then raise exception 'invalid still image file size'; end if;
  if char_length(trim(coalesce(p_scene_title, ''))) not between 1 and 80 then raise exception 'scene title required (1-80 chars)'; end if;
  if p_scene_sort_order not between 0 and 99 then raise exception 'invalid scene sort order'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('concept_selected', 'stills_review') then raise exception 'scene stills cannot be uploaded in current status'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before scene stills'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before scene stills'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before scene stills';
  end if;
  if p_storage_path not like v_order.user_id::text || '/' || v_order.id::text || '/%' then raise exception 'invalid storage path'; end if;

  insert into public.assets(order_id, user_id, category, storage_path, original_filename, mime_type, file_size, scene_title, scene_sort_order)
  values (p_order_id, v_order.user_id, 'scene_still', p_storage_path, p_original_filename, p_mime_type, p_file_size, trim(p_scene_title), p_scene_sort_order)
  returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'scene_still_uploaded',
    jsonb_build_object('asset_id', v_asset_id, 'scene_title', trim(p_scene_title), 'filename', p_original_filename)
  );
  return v_asset_id;
end;
$$;

create or replace function public.admin_publish_scene_stills(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_still_count integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('concept_selected', 'stills_review') then raise exception 'scene stills cannot be published in current status'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before scene stills'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before scene stills'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception 'photo analysis approval required before scene stills';
  end if;

  select count(*)::integer into v_still_count
  from public.assets
  where order_id = p_order_id and category = 'scene_still';
  if v_still_count = 0 then raise exception 'at least one scene still is required before publishing'; end if;

  update public.orders
  set status = 'stills_review',
      stills_approved_at = null,
      stills_approved_by = null,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'scene_stills_published', jsonb_build_object('still_count', v_still_count));
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
  if v_order_status not in ('concept_selected', 'stills_review') then
    raise exception 'scene stills cannot be deleted in current status';
  end if;

  delete from public.assets where id = p_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    v_asset.order_id,
    auth.uid(),
    'scene_still_deleted',
    jsonb_build_object('asset_id', p_asset_id, 'scene_title', v_asset.scene_title, 'filename', v_asset.original_filename)
  );
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
  v_approved_at timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found or v_order.status <> 'stills_review' then raise exception 'stills approval unavailable'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before approval'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required'; end if;

  select count(*)::integer into v_still_count
  from public.assets
  where order_id = p_order_id and category = 'scene_still';
  if v_still_count = 0 then raise exception 'scene stills not found'; end if;

  update public.orders
  set status = 'production',
      stills_approved_at = v_approved_at,
      stills_approved_by = auth.uid(),
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'scene_stills_approved',
    jsonb_build_object('still_count', v_still_count, 'approved_at', v_approved_at)
  );
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
  if v_order.stills_revision_used >= v_order.stills_revision_limit then raise exception 'stills revision limit reached'; end if;

  v_change_number := v_order.stills_revision_used + 1;

  insert into public.messages(order_id, sender_id, body)
  values (
    p_order_id,
    auth.uid(),
    '【場面イメージの調整依頼 ' || v_change_number || '回目/' || v_order.stills_revision_limit || '回】' || E'\n' || trim(p_body)
  );

  update public.orders
  set stills_revision_used = v_change_number
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'stills_change_requested',
    jsonb_build_object('stills_revision_number', v_change_number, 'stills_revision_limit', v_order.stills_revision_limit)
  );
end;
$$;

revoke all on function public.admin_register_scene_still(uuid, text, text, text, bigint, text, integer) from public, anon;
revoke all on function public.admin_publish_scene_stills(uuid) from public, anon;
revoke all on function public.admin_delete_scene_still(uuid) from public, anon;
revoke all on function public.customer_approve_scene_stills(uuid) from public, anon;
revoke all on function public.request_stills_change(uuid, text) from public, anon;
grant execute on function public.admin_register_scene_still(uuid, text, text, text, bigint, text, integer) to authenticated;
grant execute on function public.admin_publish_scene_stills(uuid) to authenticated;
grant execute on function public.admin_delete_scene_still(uuid) to authenticated;
grant execute on function public.customer_approve_scene_stills(uuid) to authenticated;
grant execute on function public.request_stills_change(uuid, text) to authenticated;

-- 6. Form simplification: reference photos are the minimum; per-memory
--    photos become optional (0-5). Bodies copied from 202607220001 with
--    the minimal edits described in each comment. ---------------------------

-- side-tail reference becomes required.
create or replace function public.save_order_production_fields(p_order_id uuid, p_data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_face_id uuid;
  v_body_id uuid;
  v_side_id uuid;
  v_policy text;
  v_description text;
  v_selected_ids uuid[] := '{}'::uuid[];
  v_traits text[] := '{}'::text[];
  v_reference_ids uuid[];
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then raise exception '入力途中のご相談を確認できませんでした。'; end if;

  begin
    v_face_id := nullif(p_data ->> 'primary_face_photo_id', '')::uuid;
    v_body_id := nullif(p_data ->> 'primary_body_photo_id', '')::uuid;
    v_side_id := nullif(p_data ->> 'side_tail_photo_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception '代表写真をもう一度選んでください。';
  end;

  if v_face_id is null then raise exception 'お顔の基準写真を1枚選んでください。'; end if;
  if v_body_id is null then raise exception '全身の基準写真を1枚選んでください。'; end if;
  if v_side_id is null then raise exception '横向き・しっぽの基準写真を1枚選んでください。'; end if;
  v_policy := p_data ->> 'appearance_policy';
  if v_policy not in ('photo_era_by_scene', 'current_appearance', 'selected_period') then
    raise exception '思い出の中の姿をどのように残すか選んでください。';
  end if;
  if coalesce(p_data ->> 'ai_reconstruction_acknowledged', 'false') <> 'true' then
    raise exception '映像表現についての確認項目をご確認ください。';
  end if;

  if jsonb_typeof(coalesce(p_data -> 'owner_locked_traits', '[]'::jsonb)) <> 'array' then
    raise exception '変わってほしくない特徴をもう一度入力してください。';
  end if;
  select coalesce(array_agg(trim(value)), '{}'::text[]) into v_traits
  from jsonb_array_elements_text(coalesce(p_data -> 'owner_locked_traits', '[]'::jsonb));
  if cardinality(v_traits) > 3 then raise exception '特徴は3つまで入力できます。'; end if;
  if exists (select 1 from unnest(v_traits) value where value = '' or char_length(value) > 80) then
    raise exception '特徴は1項目80文字以内で入力してください。';
  end if;

  if v_policy = 'selected_period' then
    v_description := trim(coalesce(p_data ->> 'selected_appearance_description', ''));
    if char_length(v_description) not between 1 and 200 then
      raise exception '残したい時期の姿を200文字以内で教えてください。';
    end if;
    if jsonb_typeof(coalesce(p_data -> 'selected_appearance_photo_ids', '[]'::jsonb)) <> 'array' then
      raise exception 'その時期が分かる写真を選んでください。';
    end if;
    begin
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_selected_ids
      from jsonb_array_elements_text(coalesce(p_data -> 'selected_appearance_photo_ids', '[]'::jsonb));
    exception when invalid_text_representation then
      raise exception 'その時期が分かる写真をもう一度選んでください。';
    end;
    if cardinality(v_selected_ids) not between 1 and 3 then
      raise exception 'その時期が分かる写真を1〜3枚選んでください。';
    end if;
    if cardinality(v_selected_ids) <> (select count(distinct photo_id) from unnest(v_selected_ids) as photo_id) then
      raise exception 'その時期が分かる写真を重複せずに選んでください。';
    end if;
  else
    v_description := null;
    v_selected_ids := '{}'::uuid[];
  end if;

  v_reference_ids := array_remove(array_cat(array[v_face_id, v_body_id, v_side_id], v_selected_ids), null);
  if (select count(distinct photo_id) from unnest(v_reference_ids) as photo_id) <> (
    select count(*) from public.assets
    where id = any(v_reference_ids)
      and order_id = p_order_id and user_id = auth.uid() and category = 'source_image'
  ) then
    raise exception '選んだ写真を確認できませんでした。アップロード済みの写真から選び直してください。';
  end if;

  update public.orders
  set primary_face_photo_id = v_face_id,
      primary_body_photo_id = v_body_id,
      side_tail_photo_id = v_side_id,
      appearance_policy = v_policy,
      selected_appearance_description = v_description,
      selected_appearance_photo_ids = v_selected_ids,
      owner_locked_traits = v_traits,
      ai_reconstruction_acknowledged = true,
      photo_analysis_status = 'not_started',
      photo_analysis_approved_at = null,
      photo_analysis_approved_by = null
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'appearance_references_saved', jsonb_build_object(
    'appearance_policy', v_policy,
    'reference_photo_count', cardinality(v_reference_ids),
    'locked_trait_count', cardinality(v_traits)
  ));
end;
$$;

-- per-memory photos become optional: empty array clears links, up to 5.
create or replace function public.assign_memory_photos(
  p_order_id uuid,
  p_memory_id uuid,
  p_asset_ids uuid[]
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;
  if cardinality(coalesce(p_asset_ids, '{}'::uuid[])) > 5 then
    raise exception '各思い出の写真は5枚までです。';
  end if;
  if not exists (
    select 1 from public.order_memories
    where id = p_memory_id and order_id = p_order_id and user_id = auth.uid()
  ) then raise exception '保存した思い出を確認できませんでした。'; end if;
  if cardinality(coalesce(p_asset_ids, '{}'::uuid[])) <> (select count(distinct photo_id) from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as photo_id) then
    raise exception '同じ写真を重複して選ぶことはできません。';
  end if;
  if (select count(distinct photo_id) from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as photo_id) <> (
    select count(*) from public.assets
    where id = any(coalesce(p_asset_ids, '{}'::uuid[])) and order_id = p_order_id
      and user_id = auth.uid() and category = 'source_image'
  ) then raise exception '思い出に選んだ写真を確認できませんでした。'; end if;
  if exists (
    select 1 from public.assets
    where id = any(coalesce(p_asset_ids, '{}'::uuid[])) and memory_id is not null and memory_id <> p_memory_id
  ) then raise exception '同じ写真は1つの思い出にだけ設定してください。'; end if;

  update public.assets
  set memory_id = null
  where order_id = p_order_id and user_id = auth.uid()
    and memory_id = p_memory_id and category = 'source_image'
    and not (id = any(coalesce(p_asset_ids, '{}'::uuid[])));
  update public.assets
  set memory_id = p_memory_id
  where id = any(coalesce(p_asset_ids, '{}'::uuid[])) and order_id = p_order_id
    and user_id = auth.uid() and category = 'source_image';
end;
$$;

-- side-tail required; per-memory photos 0-5; total-photo minimum replaced by
-- the three required references (validated in the reference ownership block).
create or replace function public.submit_memory_order(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_memory_count integer;
  v_photo_count integer;
  v_invalid_memory_count integer;
  v_launch_count integer;
  v_price integer;
  v_campaign text;
  v_reference_ids uuid[];
begin
  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid() for update;
  if not found or v_order.status <> 'awaiting_materials' then raise exception 'ご相談を送信できる状態ではありません。'; end if;
  if v_order.draft_expires_at is not null and v_order.draft_expires_at <= now() then raise exception '入力期限が過ぎました。もう一度お申し込みください。'; end if;
  if coalesce(trim(v_order.age_text), '') = '' then raise exception '年齢を入力してください。'; end if;
  if jsonb_typeof(v_order.personality) <> 'array' or jsonb_array_length(v_order.personality) < 1 then raise exception '性格を1つ以上選んでください。'; end if;
  if coalesce(trim(v_order.message_to_pet), '') = '' then raise exception 'その子へ伝えたいことを入力してください。'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception '必要な同意項目をご確認ください。'; end if;
  if v_order.primary_face_photo_id is null then raise exception 'お顔の基準写真を1枚選んでください。'; end if;
  if v_order.primary_body_photo_id is null then raise exception '全身の基準写真を1枚選んでください。'; end if;
  if v_order.side_tail_photo_id is null then raise exception '横向き・しっぽの基準写真を1枚選んでください。'; end if;
  if v_order.appearance_policy not in ('photo_era_by_scene', 'current_appearance', 'selected_period') then raise exception '思い出の中の姿をどのように残すか選んでください。'; end if;
  if v_order.ai_reconstruction_acknowledged is not true then raise exception '映像表現についての確認項目をご確認ください。'; end if;
  if cardinality(coalesce(v_order.owner_locked_traits, '{}'::text[])) > 3
     or exists (select 1 from unnest(coalesce(v_order.owner_locked_traits, '{}'::text[])) value where trim(value) = '' or char_length(trim(value)) > 80) then
    raise exception '変わってほしくない特徴を確認してください。';
  end if;
  if v_order.appearance_policy = 'selected_period' and (
    char_length(trim(coalesce(v_order.selected_appearance_description, ''))) not between 1 and 200
    or cardinality(coalesce(v_order.selected_appearance_photo_ids, '{}'::uuid[])) not between 1 and 3
  ) then raise exception '残したい時期の説明と写真を確認してください。'; end if;

  v_reference_ids := array_remove(array_cat(
    array[v_order.primary_face_photo_id, v_order.primary_body_photo_id, v_order.side_tail_photo_id],
    case when v_order.appearance_policy = 'selected_period' then coalesce(v_order.selected_appearance_photo_ids, '{}'::uuid[]) else '{}'::uuid[] end
  ), null);
  if (select count(distinct photo_id) from unnest(v_reference_ids) as photo_id) <> (
    select count(*) from public.assets where id = any(v_reference_ids)
      and order_id = p_order_id and user_id = auth.uid() and category = 'source_image'
  ) then raise exception '代表写真を確認できませんでした。選び直してください。'; end if;

  select count(*)::integer into v_memory_count from public.order_memories
  where order_id = p_order_id and user_id = auth.uid();
  if v_memory_count not between 2 and 6 then raise exception '思い出は2〜6項目入力してください。'; end if;
  select count(*)::integer into v_invalid_memory_count from (
    select m.id from public.order_memories m
    left join public.assets a on a.memory_id = m.id and a.category = 'source_image'
    where m.order_id = p_order_id and m.user_id = auth.uid()
    group by m.id having count(a.id) > 5
  ) invalid_memories;
  if v_invalid_memory_count > 0 then raise exception '各思い出の写真は5枚までです。'; end if;
  select count(*)::integer into v_photo_count from public.assets a
  join public.order_memories m on m.id = a.memory_id
  where a.order_id = p_order_id and a.user_id = auth.uid() and a.category = 'source_image';

  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-10'));
  select count(*)::integer into v_launch_count from public.orders
  where campaign_id = 'launch-monitor-10' and status not in ('awaiting_materials', 'cancelled');
  if v_launch_count < 10 then v_price := 24800; v_campaign := 'launch-monitor-10';
  else v_price := v_order.regular_price; v_campaign := null; end if;

  update public.orders
  set status = 'materials_submitted', quoted_price = v_price, campaign_id = v_campaign,
      photo_analysis_status = 'pending_operator_review', photo_analysis_approved_at = null,
      photo_analysis_approved_by = null, stage_updated_at = now(), draft_expires_at = null
  where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'materials_submitted', jsonb_build_object(
    'memory_count', v_memory_count, 'photo_count', v_photo_count, 'quoted_price', v_price,
    'campaign_id', v_campaign, 'appearance_policy', v_order.appearance_policy,
    'photo_analysis_status', 'pending_operator_review'
  ));
end;
$$;
