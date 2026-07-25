-- Record how photos containing people/minors may be used and block production
-- until the required, versioned consent evidence is complete.

alter table public.orders
  add column if not exists contains_people boolean,
  add column if not exists people_handling text,
  add column if not exists contains_minors boolean,
  add column if not exists photo_rights_consented_at timestamptz,
  add column if not exists photo_rights_consent_version text,
  add column if not exists depicted_people_consented_at timestamptz,
  add column if not exists depicted_people_consent_version text,
  add column if not exists minor_guardian_consented_at timestamptz,
  add column if not exists minor_guardian_consent_version text,
  add column if not exists people_policy_version text;

alter table public.orders
  drop constraint if exists orders_people_handling_check,
  add constraint orders_people_handling_check check (
    people_handling is null or people_handling in (
      'not_applicable', 'dog_only_crop', 'anonymous_person', 'original_still', 'consult'
    )
  ),
  drop constraint if exists orders_people_answers_consistent_check,
  add constraint orders_people_answers_consistent_check check (
    contains_people is null
    or (contains_people = false and people_handling = 'not_applicable' and contains_minors = false)
    or (contains_people = true and people_handling in ('dog_only_crop', 'anonymous_person', 'original_still', 'consult') and contains_minors is not null)
  );

create or replace function public.validate_people_photo_consent_payload(p_data jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_contains_people boolean;
  v_contains_minors boolean;
  v_people_handling text;
begin
  if jsonb_typeof(p_data -> 'contains_people') is distinct from 'boolean' then
    raise exception 'people presence answer required';
  end if;
  if jsonb_typeof(p_data -> 'contains_minors') is distinct from 'boolean' then
    raise exception 'minor presence answer required';
  end if;

  v_contains_people := (p_data ->> 'contains_people')::boolean;
  v_contains_minors := (p_data ->> 'contains_minors')::boolean;
  v_people_handling := p_data ->> 'people_handling';

  if not v_contains_people and (v_people_handling is distinct from 'not_applicable' or v_contains_minors) then
    raise exception 'people answers are inconsistent';
  end if;
  if v_contains_people and v_people_handling not in ('dog_only_crop', 'anonymous_person', 'original_still', 'consult') then
    raise exception 'people handling choice required';
  end if;
  if coalesce(p_data ->> 'photo_rights_consent_accepted', 'false') <> 'true' then
    raise exception 'photo usage rights consent required';
  end if;
  if v_contains_people and coalesce(p_data ->> 'depicted_people_consent_accepted', 'false') <> 'true' then
    raise exception 'depicted people consent required';
  end if;
  if v_contains_minors and coalesce(p_data ->> 'minor_guardian_consent_accepted', 'false') <> 'true' then
    raise exception 'minor guardian consent required';
  end if;
  if p_data ->> 'photo_rights_consent_version' is distinct from '2026-07-21-photo-v1' then
    raise exception 'current photo rights consent version required';
  end if;
  if p_data ->> 'depicted_people_consent_version' is distinct from '2026-07-21-people-v1' then
    raise exception 'current depicted people consent version required';
  end if;
  if p_data ->> 'minor_guardian_consent_version' is distinct from '2026-07-21-minor-v1' then
    raise exception 'current minor guardian consent version required';
  end if;
  if p_data ->> 'people_policy_version' is distinct from '2026-07-21-people-v1' then
    raise exception 'current people policy version required';
  end if;
end;
$$;

revoke all on function public.validate_people_photo_consent_payload(jsonb) from public, anon, authenticated;

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
    and o.photo_rights_consent_version = '2026-07-21-photo-v1'
    and o.people_policy_version = '2026-07-21-people-v1'
    and (
      (o.contains_people = false and o.people_handling = 'not_applicable' and o.contains_minors = false)
      or (
        o.contains_people = true
        and o.people_handling in ('dog_only_crop', 'anonymous_person', 'original_still', 'consult')
        and o.contains_minors is not null
        and o.depicted_people_consented_at is not null
        and o.depicted_people_consent_version = '2026-07-21-people-v1'
        and (
          o.contains_minors = false
          or (
            o.minor_guardian_consented_at is not null
            and o.minor_guardian_consent_version = '2026-07-21-minor-v1'
          )
        )
      )
    )
  ), false)
  from public.orders o
  where o.id = p_order_id;
$$;

revoke all on function public.order_has_current_consents(uuid) from public, anon, authenticated;

create or replace function public.enforce_current_order_consents()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status in (
    'materials_submitted', 'reviewing_materials', 'concepts_ready', 'concept_selected',
    'production', 'customer_review', 'revision_requested', 'quality_check', 'delivered'
  ) and not public.order_has_current_consents(new.id) then
    raise exception 'current photo, people, minor and external service consent records are required';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_current_order_consents_trigger on public.orders;
create trigger enforce_current_order_consents_trigger
before update of status on public.orders
for each row execute function public.enforce_current_order_consents();

create or replace function public.enforce_video_asset_consents()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.category in ('review_video', 'final_video') and not public.order_has_current_consents(new.order_id) then
    raise exception 'current photo, people, minor and external service consent records are required before video processing';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_video_asset_consents_trigger on public.assets;
create trigger enforce_video_asset_consents_trigger
before insert on public.assets
for each row execute function public.enforce_video_asset_consents();

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
  v_contains_people boolean;
  v_contains_minors boolean;
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

  v_contains_people := (p_data ->> 'contains_people')::boolean;
  v_contains_minors := (p_data ->> 'contains_minors')::boolean;
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
    v_contains_people, p_data ->> 'people_handling', v_contains_minors,
    v_accepted_at, '2026-07-21-photo-v1',
    case when v_contains_people then v_accepted_at else null end,
    case when v_contains_people then '2026-07-21-people-v1' else null end,
    case when v_contains_minors then v_accepted_at else null end,
    case when v_contains_minors then '2026-07-21-minor-v1' else null end,
    '2026-07-21-people-v1'
  );

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order_id, v_user_id, 'order_draft_created', jsonb_build_object(
    'quoted_price', v_regular_price, 'terms_version', '2026-07-21', 'privacy_version', '2026-07-21',
    'ai_notice_version', '2026-07-21', 'photo_rights_consent_version', '2026-07-21-photo-v1',
    'people_policy_version', '2026-07-21-people-v1', 'contains_people', v_contains_people,
    'people_handling', p_data ->> 'people_handling', 'contains_minors', v_contains_minors
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
  v_contains_people boolean;
  v_contains_minors boolean;
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

  v_contains_people := (p_data ->> 'contains_people')::boolean;
  v_contains_minors := (p_data ->> 'contains_minors')::boolean;

  update public.orders
  set pet_name = trim(p_data ->> 'pet_name'), name_kana = nullif(trim(p_data ->> 'name_kana'), ''),
      breed = trim(p_data ->> 'breed'), age_text = trim(p_data ->> 'age_text'), purpose = p_data ->> 'purpose',
      personality = p_data -> 'personality', first_meeting = nullif(trim(p_data ->> 'first_meeting'), ''),
      favorite_memory = trim(p_data ->> 'favorite_memory'), message_to_pet = trim(p_data ->> 'message_to_pet'),
      avoid_notes = nullif(trim(p_data ->> 'avoid_notes'), ''), style = trim(p_data ->> 'style'),
      aspect_ratio = trim(p_data ->> 'aspect_ratio'), narration = coalesce(nullif(trim(p_data ->> 'narration'), ''), 'ナレーションなし'),
      bgm = trim(p_data ->> 'bgm'), consented_at = v_accepted_at, terms_version = '2026-07-21',
      privacy_version = '2026-07-21', external_ai_consent_at = v_accepted_at, ai_notice_version = '2026-07-21',
      contains_people = v_contains_people, people_handling = p_data ->> 'people_handling', contains_minors = v_contains_minors,
      photo_rights_consented_at = v_accepted_at, photo_rights_consent_version = '2026-07-21-photo-v1',
      depicted_people_consented_at = case when v_contains_people then v_accepted_at else null end,
      depicted_people_consent_version = case when v_contains_people then '2026-07-21-people-v1' else null end,
      minor_guardian_consented_at = case when v_contains_minors then v_accepted_at else null end,
      minor_guardian_consent_version = case when v_contains_minors then '2026-07-21-minor-v1' else null end,
      people_policy_version = '2026-07-21-people-v1', draft_expires_at = now() + interval '7 days'
  where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials';
  if not found then raise exception 'draft order not found'; end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_draft_updated', jsonb_build_object(
    'photo_rights_consent_version', '2026-07-21-photo-v1', 'people_policy_version', '2026-07-21-people-v1',
    'contains_people', v_contains_people, 'people_handling', p_data ->> 'people_handling', 'contains_minors', v_contains_minors
  ));
end;
$$;

drop function if exists public.accept_order_consents(uuid, text, text, text, boolean, boolean);

create function public.accept_order_consents(
  p_order_id uuid,
  p_terms_version text,
  p_privacy_version text,
  p_ai_notice_version text,
  p_photo_rights_consent_version text,
  p_depicted_people_consent_version text,
  p_minor_guardian_consent_version text,
  p_people_policy_version text,
  p_contains_people boolean,
  p_people_handling text,
  p_contains_minors boolean,
  p_consent_accepted boolean,
  p_photo_rights_consent_accepted boolean,
  p_depicted_people_consent_accepted boolean,
  p_minor_guardian_consent_accepted boolean,
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
  if p_photo_rights_consent_version is distinct from '2026-07-21-photo-v1' or p_depicted_people_consent_version is distinct from '2026-07-21-people-v1' or p_minor_guardian_consent_version is distinct from '2026-07-21-minor-v1' or p_people_policy_version is distinct from '2026-07-21-people-v1' then raise exception 'current consent text versions required'; end if;
  if not p_contains_people and (p_people_handling is distinct from 'not_applicable' or p_contains_minors) then raise exception 'people answers are inconsistent'; end if;
  if p_contains_people and p_people_handling not in ('dog_only_crop', 'anonymous_person', 'original_still', 'consult') then raise exception 'people handling choice required'; end if;
  if p_contains_people and not p_depicted_people_consent_accepted then raise exception 'depicted people consent required'; end if;
  if p_contains_minors and (not p_contains_people or not p_minor_guardian_consent_accepted) then raise exception 'minor guardian consent required'; end if;

  update public.orders
  set consented_at = v_accepted_at, terms_version = p_terms_version, privacy_version = p_privacy_version,
      external_ai_consent_at = v_accepted_at, ai_notice_version = p_ai_notice_version,
      contains_people = p_contains_people, people_handling = p_people_handling, contains_minors = p_contains_minors,
      photo_rights_consented_at = v_accepted_at, photo_rights_consent_version = p_photo_rights_consent_version,
      depicted_people_consented_at = case when p_contains_people then v_accepted_at else null end,
      depicted_people_consent_version = case when p_contains_people then p_depicted_people_consent_version else null end,
      minor_guardian_consented_at = case when p_contains_minors then v_accepted_at else null end,
      minor_guardian_consent_version = case when p_contains_minors then p_minor_guardian_consent_version else null end,
      people_policy_version = p_people_policy_version
  where id = p_order_id and user_id = auth.uid() and status not in ('cancelled', 'delivered');
  if not found then raise exception 'order not found or consent unavailable'; end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'customer_consents_accepted', jsonb_build_object(
    'accepted_at', v_accepted_at, 'terms_version', p_terms_version, 'privacy_version', p_privacy_version,
    'ai_notice_version', p_ai_notice_version, 'photo_rights_consent_version', p_photo_rights_consent_version,
    'depicted_people_consent_version', case when p_contains_people then p_depicted_people_consent_version else null end,
    'minor_guardian_consent_version', case when p_contains_minors then p_minor_guardian_consent_version else null end,
    'people_policy_version', p_people_policy_version, 'contains_people', p_contains_people,
    'people_handling', p_people_handling, 'contains_minors', p_contains_minors
  ));
  return v_accepted_at;
end;
$$;

revoke all on function public.accept_order_consents(uuid, text, text, text, text, text, text, text, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean) from public;
grant execute on function public.accept_order_consents(uuid, text, text, text, text, text, text, text, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

