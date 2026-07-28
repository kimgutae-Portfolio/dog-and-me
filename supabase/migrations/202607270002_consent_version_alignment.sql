-- Policy pages were materially updated on 2026-07-27. New submissions and
-- consent renewals must store that exact version, so the UI, database record,
-- and operator checks always refer to the same text.

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
    and o.terms_version = '2026-07-27'
    and o.privacy_version = '2026-07-27'
    and o.ai_notice_version = '2026-07-27'
    and o.photo_rights_consent_version = '2026-07-25-photo-people-v2'
    and o.people_policy_version = '2026-07-25-people-policy-v2'
  ), false)
  from public.orders o
  where o.id = p_order_id;
$$;

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
  if p_data ->> 'terms_version' is distinct from '2026-07-27' or p_data ->> 'privacy_version' is distinct from '2026-07-27' or p_data ->> 'ai_notice_version' is distinct from '2026-07-27' then raise exception 'current policy versions required'; end if;
  perform public.validate_people_photo_consent_payload(p_data);

  v_order_number := 'WM-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));
  insert into public.orders (
    id, user_id, order_number, pet_name, name_kana, breed, age_text, purpose, personality, first_meeting, favorite_memory, message_to_pet,
    avoid_notes, style, aspect_ratio, narration, bgm, quoted_price, regular_price, campaign_id, status, revision_limit, revision_used,
    consented_at, terms_version, privacy_version, external_ai_consent_at, ai_notice_version, draft_expires_at, contains_people, people_handling,
    contains_minors, photo_rights_consented_at, photo_rights_consent_version, depicted_people_consented_at, depicted_people_consent_version,
    minor_guardian_consented_at, minor_guardian_consent_version, people_policy_version
  ) values (
    v_order_id, v_user_id, v_order_number, trim(p_data ->> 'pet_name'), nullif(trim(p_data ->> 'name_kana'), ''), trim(p_data ->> 'breed'),
    trim(p_data ->> 'age_text'), p_data ->> 'purpose', p_data -> 'personality', nullif(trim(p_data ->> 'first_meeting'), ''),
    trim(p_data ->> 'favorite_memory'), trim(p_data ->> 'message_to_pet'), nullif(trim(p_data ->> 'avoid_notes'), ''), trim(p_data ->> 'style'),
    trim(p_data ->> 'aspect_ratio'), coalesce(nullif(trim(p_data ->> 'narration'), ''), 'ナレーションなし'), trim(p_data ->> 'bgm'),
    v_regular_price, v_regular_price, null, 'awaiting_materials', 2, 0,
    v_accepted_at, '2026-07-27', '2026-07-27', v_accepted_at, '2026-07-27', now() + interval '7 days', null, null, null,
    v_accepted_at, '2026-07-25-photo-people-v2', null, null, null, null, '2026-07-25-people-policy-v2'
  );
  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order_id, v_user_id, 'order_draft_created', jsonb_build_object(
    'quoted_price', v_regular_price, 'terms_version', '2026-07-27', 'privacy_version', '2026-07-27', 'ai_notice_version', '2026-07-27',
    'photo_rights_consent_version', '2026-07-25-photo-people-v2', 'people_policy_version', '2026-07-25-people-policy-v2'
  ));
  return query select v_order_id, v_order_number, v_regular_price;
end;
$$;

create or replace function public.save_memory_order_draft(p_order_id uuid, p_data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_accepted_at timestamptz := now();
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
  if p_data ->> 'terms_version' is distinct from '2026-07-27' or p_data ->> 'privacy_version' is distinct from '2026-07-27' or p_data ->> 'ai_notice_version' is distinct from '2026-07-27' then raise exception 'current policy versions required'; end if;
  perform public.validate_people_photo_consent_payload(p_data);
  update public.orders set
    pet_name = trim(p_data ->> 'pet_name'), name_kana = nullif(trim(p_data ->> 'name_kana'), ''), breed = trim(p_data ->> 'breed'), age_text = trim(p_data ->> 'age_text'),
    purpose = p_data ->> 'purpose', personality = p_data -> 'personality', first_meeting = nullif(trim(p_data ->> 'first_meeting'), ''),
    favorite_memory = trim(p_data ->> 'favorite_memory'), message_to_pet = trim(p_data ->> 'message_to_pet'), avoid_notes = nullif(trim(p_data ->> 'avoid_notes'), ''),
    style = trim(p_data ->> 'style'), aspect_ratio = trim(p_data ->> 'aspect_ratio'), narration = coalesce(nullif(trim(p_data ->> 'narration'), ''), 'ナレーションなし'), bgm = trim(p_data ->> 'bgm'),
    consented_at = v_accepted_at, terms_version = '2026-07-27', privacy_version = '2026-07-27', external_ai_consent_at = v_accepted_at, ai_notice_version = '2026-07-27',
    contains_people = null, people_handling = null, contains_minors = null, photo_rights_consented_at = v_accepted_at, photo_rights_consent_version = '2026-07-25-photo-people-v2',
    depicted_people_consented_at = null, depicted_people_consent_version = null, minor_guardian_consented_at = null, minor_guardian_consent_version = null,
    people_policy_version = '2026-07-25-people-policy-v2', draft_expires_at = now() + interval '7 days'
  where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials';
  if not found then raise exception 'draft order not found'; end if;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_draft_updated', jsonb_build_object('terms_version', '2026-07-27', 'privacy_version', '2026-07-27', 'ai_notice_version', '2026-07-27', 'photo_rights_consent_version', '2026-07-25-photo-people-v2', 'people_policy_version', '2026-07-25-people-policy-v2'));
end;
$$;

create or replace function public.accept_order_consents(
  p_order_id uuid, p_terms_version text, p_privacy_version text, p_ai_notice_version text,
  p_photo_rights_consent_version text, p_people_policy_version text, p_consent_accepted boolean,
  p_photo_rights_consent_accepted boolean, p_external_ai_consent_accepted boolean
)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare v_accepted_at timestamptz := now();
begin
  if not p_consent_accepted or not p_photo_rights_consent_accepted or not p_external_ai_consent_accepted then raise exception 'required consents are missing'; end if;
  if p_terms_version is distinct from '2026-07-27' or p_privacy_version is distinct from '2026-07-27' or p_ai_notice_version is distinct from '2026-07-27' then raise exception 'current policy versions required'; end if;
  if p_photo_rights_consent_version is distinct from '2026-07-25-photo-people-v2' or p_people_policy_version is distinct from '2026-07-25-people-policy-v2' then raise exception 'current consent text versions required'; end if;
  update public.orders set
    consented_at = v_accepted_at, terms_version = p_terms_version, privacy_version = p_privacy_version, external_ai_consent_at = v_accepted_at, ai_notice_version = p_ai_notice_version,
    contains_people = null, people_handling = null, contains_minors = null, photo_rights_consented_at = v_accepted_at, photo_rights_consent_version = p_photo_rights_consent_version,
    depicted_people_consented_at = null, depicted_people_consent_version = null, minor_guardian_consented_at = null, minor_guardian_consent_version = null, people_policy_version = p_people_policy_version
  where id = p_order_id and user_id = auth.uid() and status not in ('cancelled', 'delivered');
  if not found then raise exception 'order not found or consent unavailable'; end if;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'customer_consents_accepted', jsonb_build_object('accepted_at', v_accepted_at, 'terms_version', p_terms_version, 'privacy_version', p_privacy_version, 'ai_notice_version', p_ai_notice_version, 'photo_rights_consent_version', p_photo_rights_consent_version, 'people_policy_version', p_people_policy_version));
  return v_accepted_at;
end;
$$;
