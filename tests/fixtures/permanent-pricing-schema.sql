-- Minimal, disposable PostgreSQL fixture. Never run against a real project.
create schema auth;
create role anon;
create role authenticated;
create role service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid,
  order_number text, pet_name text, name_kana text, breed text, age_text text,
  purpose text, personality jsonb, first_meeting text, favorite_memory text,
  message_to_pet text, avoid_notes text, style text, aspect_ratio text,
  narration text, bgm text, quoted_price integer not null default 14800,
  regular_price integer not null default 14800, campaign_id text,
  status text not null default 'awaiting_materials',
  payment_status text not null default 'pending',
  revision_limit integer, revision_used integer, consented_at timestamptz,
  terms_version text, privacy_version text, external_ai_consent_at timestamptz,
  ai_notice_version text, draft_expires_at timestamptz, contains_people boolean,
  people_handling text, contains_minors boolean, photo_rights_consented_at timestamptz,
  photo_rights_consent_version text, depicted_people_consented_at timestamptz,
  depicted_people_consent_version text, minor_guardian_consented_at timestamptz,
  minor_guardian_consent_version text, people_policy_version text,
  ai_reconstruction_acknowledged boolean not null default true,
  photo_analysis_status text, photo_analysis_approved_at timestamptz,
  photo_analysis_approved_by uuid, stage_updated_at timestamptz
);
create table public.order_events (
  order_id uuid, actor_id uuid, event_type text, payload jsonb
);
create table public.order_memories (
  id uuid primary key default gen_random_uuid(), order_id uuid, user_id uuid
);
create table public.assets (
  id uuid primary key default gen_random_uuid(), order_id uuid, user_id uuid,
  memory_id uuid, category text, memory_photo_sort_order integer
);
create table public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(), order_id uuid, status text
);
create function public.validate_people_photo_consent_payload(p_data jsonb)
returns void language plpgsql as $$
begin
  if p_data ->> 'photo_rights_accepted' is distinct from 'true' then
    raise exception 'photo rights consent required';
  end if;
end;
$$;
create function public.order_has_current_consents(p_order_id uuid)
returns boolean language sql stable as $$
  select coalesce(current_setting('test.current_consents', true), 'true') <> 'false';
$$;

create function public.test_pricing_payload() returns jsonb language sql as $$
  select jsonb_build_object(
    'pet_name', 'モカ', 'breed', 'トイプードル', 'age_text', '5歳',
    'purpose', '思い出', 'personality', jsonb_build_array('元気'),
    'favorite_memory', '毎日の散歩', 'message_to_pet', 'ありがとう',
    'style', '水彩', 'aspect_ratio', '9:16', 'bgm', 'やさしい',
    'consent_accepted', true, 'external_ai_consent_accepted', true,
    'photo_rights_accepted', true,
    'terms_version', '2026-08-23-revision-2-1-v1',
    'privacy_version', '2026-07-27',
    'ai_notice_version', '2026-08-23-revision-2-1-v1'
  );
$$;
create function public.test_add_five_stories(p_order_id uuid)
returns void language plpgsql as $$
declare v_memory_id uuid;
begin
  for story_number in 1..5 loop
    insert into public.order_memories(order_id, user_id)
    values (p_order_id, auth.uid()) returning id into v_memory_id;
    insert into public.assets(order_id, user_id, memory_id, category, memory_photo_sort_order)
    values (p_order_id, auth.uid(), v_memory_id, 'source_image', 1);
  end loop;
end;
$$;
