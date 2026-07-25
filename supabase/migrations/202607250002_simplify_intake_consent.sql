-- Intake simplification: remove the appearance-policy question, the
-- owner-locked-traits question, and the three people/minor questions.
--
-- People photos now follow one fixed service policy: faces are never used
-- or generated; people may appear only in ways where the face is not
-- recognizable (back views, hands, silhouettes). The customer records a
-- single consolidated attestation (photo rights + third-party/guardian
-- consent + fixed face policy) instead of a branching questionnaire.
--
-- Consolidated consent versions introduced here:
--   photo_rights_consent_version : 2026-07-25-photo-people-v2
--   people_policy_version        : 2026-07-25-people-policy-v2
-- terms/privacy/ai_notice stay at 2026-07-21 (unchanged everywhere).
--
-- contains_people / people_handling / contains_minors are no longer asked
-- and stay null for new orders (columns kept for legacy orders).
-- appearance_policy is fixed to 'photo_era_by_scene'; owner_locked_traits
-- is no longer collected from customers (operators derive identity traits
-- during photo analysis; column kept).

-- 1. Consolidated consent payload validation --------------------------------

create or replace function public.validate_people_photo_consent_payload(p_data jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  if coalesce(p_data ->> 'photo_rights_consent_accepted', 'false') <> 'true' then
    raise exception 'photo usage rights consent required';
  end if;
  if p_data ->> 'photo_rights_consent_version' is distinct from '2026-07-25-photo-people-v2' then
    raise exception 'current photo rights consent version required';
  end if;
  if p_data ->> 'people_policy_version' is distinct from '2026-07-25-people-policy-v2' then
    raise exception 'current people policy version required';
  end if;
end;
$$;

revoke all on function public.validate_people_photo_consent_payload(jsonb) from public, anon, authenticated;

-- 2. Simplified consent completeness check ----------------------------------

create or replace function public.order_has_current_consents(p_order_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    o.consented_at is not null
    and o.external_ai_consent_at is not null
    and o.photo_rights_consented_at is not null
    and o.terms_version = '2026-07-21'
    and o.privacy_version = '2026-07-21'
    and o.ai_notice_version = '2026-07-21'
    and o.photo_rights_consent_version = '2026-07-25-photo-people-v2'
    and o.people_policy_version = '2026-07-25-people-policy-v2'
  ), false)
  from public.orders o
  where o.id = p_order_id;
$$;

revoke all on function public.order_has_current_consents(uuid) from public, anon, authenticated;

-- 3. Order create/save drafts without people questions ----------------------

create or replace function public.create_memory_order(p_data jsonb)
returns table(order_id uuid, order_number text, quoted_price integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_regular_price integer := 29800;
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_data ->> 'pet_name'), '') = '' then raise exception 'pet name required'; end if;
  if coalesce(trim(p_data ->> 'breed'), '') = '' then raise exception 'breed required'; end if;
  if coalesce(trim(p_data ->> 'age_text'), '') = '' then raise exception 'age required'; end if;
  if jsonb_typeof(coalesce(p_data -> 'personality', 'null'::jsonb)) <> 'array' or jsonb_array_length(p_data -> 'personality') < 1 then raise exception 'personality required'; end if;
  if coalesce(trim(p_data ->> 'favorite_memory'), '') = '' then raise exception 'favorite memory required'; end if;
  if coalesce(trim(p_data ->> 'message_to_pet'), '') = '' then raise exception 'message to pet required'; end if;
  if coalesce(trim(p_data ->> 'style'), '') = '' then raise exception 'style required'; end if;
  if coalesce(trim(p_data ->> 'aspect_ratio'), '') = '' then raise exception 'aspect ratio required'; end if;
  if coalesce(trim(p_data ->> 'bgm'), '') = '' then raise exception 'bgm required'; end if;
  if coalesce(p_data ->> 'consent_accepted', 'false') <> 'true' then raise exception 'terms and privacy consent required'; end if;
  if coalesce(p_data ->> 'external_ai_consent_accepted', 'false') <> 'true' then raise exception 'external AI processing consent required'; end if;
  if p_data ->> 'terms_version' is distinct from '2026-07-21' or p_data ->> 'privacy_version' is distinct from '2026-07-21' or p_data ->> 'ai_notice_version' is distinct from '2026-07-21' then raise exception 'current policy versions required'; end if;
  perform public.validate_people_photo_consent_payload(p_data);

  v_order_number := 'WM-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));

  insert into public.orders (
    id, user_id, order_number, pet_name, name_kana, breed, age_text,
    purpose, personality, first_meeting, favorite_memory, message_to_pet,
    avoid_notes, style, aspect_ratio, narration, bgm, quoted_price,
    regular_price, campaign_id, status, revision_limit, revision_used,
    consented_at, terms_version, privacy_version, external_ai_consent_at,
    ai_notice_version, draft_expires_at, contains_people, people_handling,
    contains_minors, photo_rights_consented_at, photo_rights_consent_version,
    depicted_people_consented_at, depicted_people_consent_version,
    minor_guardian_consented_at, minor_guardian_consent_version, people_policy_version
  ) values (
    v_order_id, v_user_id, v_order_number, trim(p_data ->> 'pet_name'),
    nullif(trim(p_data ->> 'name_kana'), ''), trim(p_data ->> 'breed'),
    trim(p_data ->> 'age_text'), p_data ->> 'purpose', p_data -> 'personality',
    nullif(trim(p_data ->> 'first_meeting'), ''), trim(p_data ->> 'favorite_memory'),
    trim(p_data ->> 'message_to_pet'), nullif(trim(p_data ->> 'avoid_notes'), ''),
    trim(p_data ->> 'style'), trim(p_data ->> 'aspect_ratio'),
    coalesce(nullif(trim(p_data ->> 'narration'), ''), 'ナレーションなし'), trim(p_data ->> 'bgm'),
    v_regular_price, v_regular_price, null, 'awaiting_materials', 2, 0,
    v_accepted_at, '2026-07-21', '2026-07-21', v_accepted_at, '2026-07-21', now() + interval '7 days',
    null, null, null,
    v_accepted_at, '2026-07-25-photo-people-v2',
    null, null, null, null,
    '2026-07-25-people-policy-v2'
  );

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order_id, v_user_id, 'order_draft_created', jsonb_build_object(
    'quoted_price', v_regular_price, 'terms_version', '2026-07-21', 'privacy_version', '2026-07-21',
    'ai_notice_version', '2026-07-21', 'photo_rights_consent_version', '2026-07-25-photo-people-v2',
    'people_policy_version', '2026-07-25-people-policy-v2'
  ));

  return query select v_order_id, v_order_number, v_regular_price;
end;
$$;

create or replace function public.save_memory_order_draft(p_order_id uuid, p_data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_accepted_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_data ->> 'pet_name'), '') = '' then raise exception 'pet name required'; end if;
  if coalesce(trim(p_data ->> 'breed'), '') = '' then raise exception 'breed required'; end if;
  if coalesce(trim(p_data ->> 'age_text'), '') = '' then raise exception 'age required'; end if;
  if jsonb_typeof(coalesce(p_data -> 'personality', 'null'::jsonb)) <> 'array' or jsonb_array_length(p_data -> 'personality') < 1 then raise exception 'personality required'; end if;
  if coalesce(trim(p_data ->> 'favorite_memory'), '') = '' then raise exception 'favorite memory required'; end if;
  if coalesce(trim(p_data ->> 'message_to_pet'), '') = '' then raise exception 'message to pet required'; end if;
  if coalesce(trim(p_data ->> 'style'), '') = '' or coalesce(trim(p_data ->> 'aspect_ratio'), '') = '' or coalesce(trim(p_data ->> 'bgm'), '') = '' then raise exception 'film settings required'; end if;
  if coalesce(p_data ->> 'consent_accepted', 'false') <> 'true' or coalesce(p_data ->> 'external_ai_consent_accepted', 'false') <> 'true' then raise exception 'current consent required'; end if;
  if p_data ->> 'terms_version' is distinct from '2026-07-21' or p_data ->> 'privacy_version' is distinct from '2026-07-21' or p_data ->> 'ai_notice_version' is distinct from '2026-07-21' then raise exception 'current policy versions required'; end if;
  perform public.validate_people_photo_consent_payload(p_data);

  update public.orders
  set pet_name = trim(p_data ->> 'pet_name'), name_kana = nullif(trim(p_data ->> 'name_kana'), ''),
      breed = trim(p_data ->> 'breed'), age_text = trim(p_data ->> 'age_text'), purpose = p_data ->> 'purpose',
      personality = p_data -> 'personality', first_meeting = nullif(trim(p_data ->> 'first_meeting'), ''),
      favorite_memory = trim(p_data ->> 'favorite_memory'), message_to_pet = trim(p_data ->> 'message_to_pet'),
      avoid_notes = nullif(trim(p_data ->> 'avoid_notes'), ''), style = trim(p_data ->> 'style'),
      aspect_ratio = trim(p_data ->> 'aspect_ratio'), narration = coalesce(nullif(trim(p_data ->> 'narration'), ''), 'ナレーションなし'),
      bgm = trim(p_data ->> 'bgm'), consented_at = v_accepted_at, terms_version = '2026-07-21',
      privacy_version = '2026-07-21', external_ai_consent_at = v_accepted_at, ai_notice_version = '2026-07-21',
      contains_people = null, people_handling = null, contains_minors = null,
      photo_rights_consented_at = v_accepted_at, photo_rights_consent_version = '2026-07-25-photo-people-v2',
      depicted_people_consented_at = null, depicted_people_consent_version = null,
      minor_guardian_consented_at = null, minor_guardian_consent_version = null,
      people_policy_version = '2026-07-25-people-policy-v2', draft_expires_at = now() + interval '7 days'
  where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials';
  if not found then raise exception 'draft order not found'; end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_draft_updated', jsonb_build_object(
    'photo_rights_consent_version', '2026-07-25-photo-people-v2',
    'people_policy_version', '2026-07-25-people-policy-v2'
  ));
end;
$$;

-- 4. Simplified consent renewal RPC -----------------------------------------

drop function if exists public.accept_order_consents(uuid, text, text, text, text, text, text, text, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean);

create function public.accept_order_consents(
  p_order_id uuid,
  p_terms_version text,
  p_privacy_version text,
  p_ai_notice_version text,
  p_photo_rights_consent_version text,
  p_people_policy_version text,
  p_consent_accepted boolean,
  p_photo_rights_consent_accepted boolean,
  p_external_ai_consent_accepted boolean
)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_accepted_at timestamptz := now();
begin
  if not p_consent_accepted or not p_photo_rights_consent_accepted or not p_external_ai_consent_accepted then raise exception 'required consents are missing'; end if;
  if p_terms_version is distinct from '2026-07-21' or p_privacy_version is distinct from '2026-07-21' or p_ai_notice_version is distinct from '2026-07-21' then raise exception 'current policy versions required'; end if;
  if p_photo_rights_consent_version is distinct from '2026-07-25-photo-people-v2' or p_people_policy_version is distinct from '2026-07-25-people-policy-v2' then
    raise exception 'current consent text versions required';
  end if;

  update public.orders
  set consented_at = v_accepted_at, terms_version = p_terms_version, privacy_version = p_privacy_version,
      external_ai_consent_at = v_accepted_at, ai_notice_version = p_ai_notice_version,
      contains_people = null, people_handling = null, contains_minors = null,
      photo_rights_consented_at = v_accepted_at, photo_rights_consent_version = p_photo_rights_consent_version,
      depicted_people_consented_at = null, depicted_people_consent_version = null,
      minor_guardian_consented_at = null, minor_guardian_consent_version = null,
      people_policy_version = p_people_policy_version
  where id = p_order_id and user_id = auth.uid() and status not in ('cancelled', 'delivered');
  if not found then raise exception 'order not found or consent unavailable'; end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'customer_consents_accepted', jsonb_build_object(
    'accepted_at', v_accepted_at, 'terms_version', p_terms_version, 'privacy_version', p_privacy_version,
    'ai_notice_version', p_ai_notice_version, 'photo_rights_consent_version', p_photo_rights_consent_version,
    'people_policy_version', p_people_policy_version
  ));
  return v_accepted_at;
end;
$$;

revoke all on function public.accept_order_consents(uuid, text, text, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.accept_order_consents(uuid, text, text, text, text, text, boolean, boolean, boolean) to authenticated;

-- 5. Production fields without the appearance/traits questions --------------
-- appearance_policy is fixed; owner_locked_traits no longer collected from
-- the customer (kept as an operator-filled column).

create or replace function public.save_order_production_fields(p_order_id uuid, p_data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_face_id uuid;
  v_body_id uuid;
  v_side_id uuid;
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
  if coalesce(p_data ->> 'ai_reconstruction_acknowledged', 'false') <> 'true' then
    raise exception '映像表現についての確認項目をご確認ください。';
  end if;

  v_reference_ids := array_remove(array[v_face_id, v_body_id, v_side_id], null);
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
      appearance_policy = 'photo_era_by_scene',
      selected_appearance_description = null,
      selected_appearance_photo_ids = '{}'::uuid[],
      ai_reconstruction_acknowledged = true,
      photo_analysis_status = 'not_started',
      photo_analysis_approved_at = null,
      photo_analysis_approved_by = null
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'appearance_references_saved', jsonb_build_object(
    'appearance_policy', 'photo_era_by_scene',
    'reference_photo_count', cardinality(v_reference_ids)
  ));
end;
$$;

-- 6. submit_memory_order without appearance/traits checks -------------------
-- (kept: reference photo checks, memory checks from 202607250001, stills of
--  photo_analysis pipeline)

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
  if v_order.ai_reconstruction_acknowledged is not true then raise exception '映像表現についての確認項目をご確認ください。'; end if;

  v_reference_ids := array_remove(array[v_order.primary_face_photo_id, v_order.primary_body_photo_id, v_order.side_tail_photo_id], null);
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
    'campaign_id', v_campaign, 'photo_analysis_status', 'pending_operator_review'
  ));
end;
$$;
