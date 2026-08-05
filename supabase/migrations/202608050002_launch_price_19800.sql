-- New public pricing from 2026-08-05.
-- Existing orders keep their quoted_price and regular_price. Only orders
-- created/submitted after this migration use the new launch campaign.

alter table public.orders alter column regular_price set default 24800;

create or replace function public.get_memory_film_pricing()
returns table(
  current_price integer,
  regular_price integer,
  launch_limit integer,
  launch_used integer,
  launch_remaining integer,
  campaign_active boolean
)
language sql
stable
security definer set search_path = public
as $$
  with counts as (
    select count(*)::integer as used
    from public.orders
    where campaign_id = 'launch-monitor-19800-10'
      and status not in ('awaiting_materials', 'cancelled')
  )
  select
    case when used < 10 then 19800 else 24800 end,
    24800,
    10,
    used,
    greatest(10 - used, 0),
    used < 10
  from counts;
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
  v_regular_price integer := 24800;
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_data ->> 'pet_name'), '') = '' then raise exception 'pet name required'; end if;
  if coalesce(trim(p_data ->> 'breed'), '') = '' then raise exception 'breed required'; end if;
  if coalesce(trim(p_data ->> 'age_text'), '') = '' then raise exception 'age required'; end if;
  if jsonb_typeof(coalesce(p_data -> 'personality', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_data -> 'personality') < 1 then raise exception 'personality required'; end if;
  if coalesce(trim(p_data ->> 'favorite_memory'), '') = '' then raise exception 'favorite memory required'; end if;
  if coalesce(trim(p_data ->> 'message_to_pet'), '') = '' then raise exception 'message to pet required'; end if;
  if coalesce(trim(p_data ->> 'style'), '') = '' then raise exception 'style required'; end if;
  if coalesce(trim(p_data ->> 'aspect_ratio'), '') = '' then raise exception 'aspect ratio required'; end if;
  if coalesce(trim(p_data ->> 'bgm'), '') = '' then raise exception 'bgm required'; end if;
  if coalesce(p_data ->> 'consent_accepted', 'false') <> 'true' then raise exception 'terms and privacy consent required'; end if;
  if coalesce(p_data ->> 'external_ai_consent_accepted', 'false') <> 'true' then raise exception 'external AI processing consent required'; end if;
  if p_data ->> 'terms_version' is distinct from '2026-07-29-style-v2'
     or p_data ->> 'privacy_version' is distinct from '2026-07-27'
     or p_data ->> 'ai_notice_version' is distinct from '2026-07-29-style-v2' then
    raise exception 'current policy versions required';
  end if;
  perform public.validate_people_photo_consent_payload(p_data);

  v_order_number := 'WM-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));
  insert into public.orders (
    id, user_id, order_number, pet_name, name_kana, breed, age_text, purpose,
    personality, first_meeting, favorite_memory, message_to_pet, avoid_notes,
    style, aspect_ratio, narration, bgm, quoted_price, regular_price,
    campaign_id, status, revision_limit, revision_used, consented_at,
    terms_version, privacy_version, external_ai_consent_at, ai_notice_version,
    draft_expires_at, contains_people, people_handling, contains_minors,
    photo_rights_consented_at, photo_rights_consent_version,
    depicted_people_consented_at, depicted_people_consent_version,
    minor_guardian_consented_at, minor_guardian_consent_version,
    people_policy_version
  ) values (
    v_order_id, v_user_id, v_order_number, trim(p_data ->> 'pet_name'),
    nullif(trim(p_data ->> 'name_kana'), ''), trim(p_data ->> 'breed'),
    trim(p_data ->> 'age_text'), p_data ->> 'purpose',
    p_data -> 'personality', nullif(trim(p_data ->> 'first_meeting'), ''),
    trim(p_data ->> 'favorite_memory'), trim(p_data ->> 'message_to_pet'),
    nullif(trim(p_data ->> 'avoid_notes'), ''), trim(p_data ->> 'style'),
    trim(p_data ->> 'aspect_ratio'),
    coalesce(nullif(trim(p_data ->> 'narration'), ''), 'ナレーションなし'),
    trim(p_data ->> 'bgm'), v_regular_price, v_regular_price, null,
    'awaiting_materials', 2, 0, v_accepted_at, '2026-07-29-style-v2',
    '2026-07-27', v_accepted_at, '2026-07-29-style-v2',
    now() + interval '7 days', null, null, null, v_accepted_at,
    '2026-07-25-photo-people-v2', null, null, null, null,
    '2026-07-25-people-policy-v2'
  );
  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order_id, v_user_id, 'order_draft_created', jsonb_build_object(
    'quoted_price', v_regular_price,
    'terms_version', '2026-07-29-style-v2',
    'privacy_version', '2026-07-27',
    'ai_notice_version', '2026-07-29-style-v2',
    'photo_rights_consent_version', '2026-07-25-photo-people-v2',
    'people_policy_version', '2026-07-25-people-policy-v2'
  ));
  return query select v_order_id, v_order_number, v_regular_price;
end;
$$;

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
begin
  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid() for update;
  if not found or v_order.status <> 'awaiting_materials' then raise exception 'ご相談を送信できる状態ではありません。'; end if;
  if v_order.draft_expires_at is not null and v_order.draft_expires_at <= now() then raise exception '入力期限が過ぎました。もう一度お申し込みください。'; end if;
  if coalesce(trim(v_order.age_text), '') = '' then raise exception '年齢を入力してください。'; end if;
  if jsonb_typeof(v_order.personality) <> 'array' or jsonb_array_length(v_order.personality) < 1 then raise exception '性格を1つ以上選んでください。'; end if;
  if coalesce(trim(v_order.message_to_pet), '') = '' then raise exception 'その子へ伝えたいことを入力してください。'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception '必要な同意項目をご確認ください。'; end if;
  if v_order.ai_reconstruction_acknowledged is not true then raise exception '絵本としての再構成についてご確認ください。'; end if;

  select count(*)::integer into v_memory_count from public.order_memories
  where order_id = p_order_id and user_id = auth.uid();
  if v_memory_count <> 5 then raise exception '物語は5項目入力してください。'; end if;

  select count(*)::integer into v_invalid_memory_count from (
    select memory.id
    from public.order_memories memory
    left join public.assets asset
      on asset.memory_id = memory.id
      and asset.category = 'source_image'
      and asset.memory_photo_sort_order is not null
    where memory.order_id = p_order_id and memory.user_id = auth.uid()
    group by memory.id
    having count(asset.id) not between 1 and 3
  ) invalid_memories;
  if v_invalid_memory_count > 0 then raise exception '各物語に写真を1〜3枚選んでください。'; end if;

  select count(*)::integer into v_photo_count
  from public.assets asset
  join public.order_memories memory on memory.id = asset.memory_id
  where asset.order_id = p_order_id
    and asset.user_id = auth.uid()
    and asset.category = 'source_image'
    and asset.memory_photo_sort_order is not null;

  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-19800-10'));
  select count(*)::integer into v_launch_count from public.orders
  where campaign_id = 'launch-monitor-19800-10'
    and status not in ('awaiting_materials', 'cancelled');
  if v_launch_count < 10 then
    v_price := 19800;
    v_campaign := 'launch-monitor-19800-10';
  else
    v_price := v_order.regular_price;
    v_campaign := null;
  end if;

  update public.orders
  set status = 'materials_submitted',
      quoted_price = v_price,
      campaign_id = v_campaign,
      photo_analysis_status = 'pending_operator_review',
      photo_analysis_approved_at = null,
      photo_analysis_approved_by = null,
      stage_updated_at = now(),
      draft_expires_at = null
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'materials_submitted', jsonb_build_object(
    'story_count', v_memory_count,
    'photo_count', v_photo_count,
    'quoted_price', v_price,
    'campaign_id', v_campaign,
    'source_model', 'story_specific_photos',
    'photo_analysis_status', 'pending_operator_review'
  ));
end;
$$;

revoke all on function public.get_memory_film_pricing() from public;
grant execute on function public.get_memory_film_pricing() to anon, authenticated;
revoke all on function public.create_memory_order(jsonb) from public;
grant execute on function public.create_memory_order(jsonb) to authenticated;
revoke all on function public.submit_memory_order(uuid) from public, anon;
grant execute on function public.submit_memory_order(uuid) to authenticated;
