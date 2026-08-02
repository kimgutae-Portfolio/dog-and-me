-- Story-scene source model.
--
-- The customer no longer submits separate face/body/side references. Each of
-- 3-5 story entries owns 1-3 photos; position 1 is the primary image used to
-- illustrate and animate that story, and positions 2-3 are optional support.

alter table public.assets
  add column if not exists memory_photo_sort_order smallint;

-- There are no live customer orders at this changeover. Normalize any test or
-- unfinished data so the database itself reflects the new five-story limit.
delete from public.order_memories where sort_order > 5;

with ranked as (
  select
    id,
    row_number() over (
      partition by memory_id
      order by album_sort_order, created_at, id
    ) as position
  from public.assets
  where category = 'source_image' and memory_id is not null
)
update public.assets asset
set memory_photo_sort_order = case
  when ranked.position <= 3 then ranked.position::smallint
  else null
end,
memory_id = case when ranked.position <= 3 then asset.memory_id else null end
from ranked
where ranked.id = asset.id;

alter table public.assets
  drop constraint if exists assets_memory_photo_sort_order_check,
  add constraint assets_memory_photo_sort_order_check check (
    memory_photo_sort_order is null or memory_photo_sort_order between 1 and 3
  );

create unique index if not exists assets_memory_photo_position_unique
  on public.assets(memory_id, memory_photo_sort_order)
  where category = 'source_image'
    and memory_id is not null
    and memory_photo_sort_order is not null;

alter table public.order_memories
  drop constraint if exists order_memories_sort_order_check,
  add constraint order_memories_sort_order_check check (sort_order between 1 and 5);

create or replace function public.save_order_memory_entry(
  p_order_id uuid,
  p_client_key text,
  p_sort_order integer,
  p_title text,
  p_when_text text,
  p_location text,
  p_description text,
  p_dog_behavior text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_memory_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then raise exception 'draft order not found'; end if;
  if p_sort_order not between 1 and 5 then raise exception 'story order must be between 1 and 5'; end if;
  if char_length(trim(coalesce(p_client_key, ''))) not between 1 and 100 then raise exception 'story client key required'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80 then raise exception 'story title required'; end if;
  if char_length(trim(coalesce(p_description, ''))) not between 30 and 2000 then raise exception 'story description must contain at least 30 characters'; end if;
  if p_dog_behavior is not null and char_length(trim(p_dog_behavior)) > 1000 then raise exception 'dog behavior must be 1000 characters or fewer'; end if;

  insert into public.order_memories (
    order_id, user_id, client_key, sort_order, title, when_text, location, description, dog_behavior
  ) values (
    p_order_id, auth.uid(), trim(p_client_key), p_sort_order, trim(p_title),
    nullif(trim(coalesce(p_when_text, '')), ''), nullif(trim(coalesce(p_location, '')), ''),
    trim(p_description), nullif(trim(coalesce(p_dog_behavior, '')), '')
  )
  on conflict (order_id, client_key) do update
  set sort_order = excluded.sort_order,
      title = excluded.title,
      when_text = excluded.when_text,
      location = excluded.location,
      description = excluded.description,
      dog_behavior = excluded.dog_behavior,
      updated_at = now()
  returning id into v_memory_id;

  return v_memory_id;
end;
$$;

create or replace function public.prune_order_memories(
  p_order_id uuid,
  p_client_keys text[]
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then raise exception '入力途中のご相談を確認できませんでした。'; end if;
  if cardinality(coalesce(p_client_keys, '{}'::text[])) not between 3 and 5 then
    raise exception '物語は3〜5項目で入力してください。';
  end if;
  if cardinality(p_client_keys) <> (
    select count(distinct key) from unnest(p_client_keys) as key
  ) then raise exception '物語の識別情報が重複しています。'; end if;

  delete from public.order_memories
  where order_id = p_order_id
    and user_id = auth.uid()
    and not (client_key = any(p_client_keys));
end;
$$;

create or replace function public.assign_memory_photos(
  p_order_id uuid,
  p_memory_id uuid,
  p_asset_ids uuid[]
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_photo_count integer := cardinality(coalesce(p_asset_ids, '{}'::uuid[]));
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;
  if v_photo_count not between 1 and 3 then
    raise exception '各物語には写真を1〜3枚選んでください。';
  end if;
  if not exists (
    select 1 from public.order_memories
    where id = p_memory_id and order_id = p_order_id and user_id = auth.uid()
  ) then raise exception '保存した物語を確認できませんでした。'; end if;
  if v_photo_count <> (
    select count(distinct photo_id) from unnest(p_asset_ids) as photo_id
  ) then raise exception '同じ写真を重複して選ぶことはできません。'; end if;
  if v_photo_count <> (
    select count(*) from public.assets
    where id = any(p_asset_ids) and order_id = p_order_id
      and user_id = auth.uid() and category = 'source_image'
  ) then raise exception '物語に選んだ写真を確認できませんでした。'; end if;
  if exists (
    select 1 from public.assets
    where id = any(p_asset_ids) and memory_id is not null and memory_id <> p_memory_id
  ) then raise exception '同じ写真は1つの物語にだけ設定してください。'; end if;

  update public.assets
  set memory_id = null, memory_photo_sort_order = null
  where order_id = p_order_id and user_id = auth.uid()
    and memory_id = p_memory_id and category = 'source_image';

  update public.assets asset
  set memory_id = p_memory_id,
      memory_photo_sort_order = selected.position::smallint
  from unnest(p_asset_ids) with ordinality as selected(asset_id, position)
  where asset.id = selected.asset_id
    and asset.order_id = p_order_id
    and asset.user_id = auth.uid()
    and asset.category = 'source_image';
end;
$$;

-- Keep the existing RPC name used by the intake, but reduce it to the single
-- storybook acknowledgement. Legacy appearance columns are intentionally
-- cleared and no longer participate in validation or production.
create or replace function public.save_order_production_fields(
  p_order_id uuid,
  p_data jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then raise exception '入力途中のご相談を確認できませんでした。'; end if;
  if coalesce(p_data ->> 'ai_reconstruction_acknowledged', 'false') <> 'true' then
    raise exception '絵本として再構成することについての確認項目をご確認ください。';
  end if;

  update public.orders
  set primary_face_photo_id = null,
      primary_body_photo_id = null,
      side_tail_photo_id = null,
      appearance_policy = 'photo_era_by_scene',
      selected_appearance_description = null,
      selected_appearance_photo_ids = '{}'::uuid[],
      owner_locked_traits = '{}'::text[],
      ai_reconstruction_acknowledged = true,
      photo_analysis_status = 'not_started',
      photo_analysis_approved_at = null,
      photo_analysis_approved_by = null
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'storybook_sources_confirmed', jsonb_build_object(
    'source_model', 'story_specific_photos',
    'global_appearance_references', false
  ));
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
  if v_memory_count not between 3 and 5 then raise exception '物語は3〜5項目入力してください。'; end if;

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

  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-10'));
  select count(*)::integer into v_launch_count from public.orders
  where campaign_id = 'launch-monitor-10' and status not in ('awaiting_materials', 'cancelled');
  if v_launch_count < 10 then v_price := 24800; v_campaign := 'launch-monitor-10';
  else v_price := v_order.regular_price; v_campaign := null; end if;

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

revoke all on function public.prune_order_memories(uuid, text[]) from public, anon;
grant execute on function public.prune_order_memories(uuid, text[]) to authenticated;
revoke all on function public.assign_memory_photos(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.assign_memory_photos(uuid, uuid, uuid[]) to authenticated;
revoke all on function public.save_order_production_fields(uuid, jsonb) from public, anon;
grant execute on function public.save_order_production_fields(uuid, jsonb) to authenticated;
revoke all on function public.submit_memory_order(uuid) from public, anon;
grant execute on function public.submit_memory_order(uuid) to authenticated;
