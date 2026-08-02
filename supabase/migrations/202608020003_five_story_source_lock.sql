-- Fixed five-story structure, immutable approved sources, and concept coverage.

alter table public.concepts
  add column if not exists story_scenes jsonb not null default '[]'::jsonb;

alter table public.concepts
  drop constraint if exists concepts_story_scenes_array_check,
  add constraint concepts_story_scenes_array_check check (
    jsonb_typeof(story_scenes) = 'array'
  );

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
  if cardinality(coalesce(p_client_keys, '{}'::text[])) <> 5 then
    raise exception '物語は5項目入力してください。';
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
  v_order public.orders%rowtype;
  v_photo_count integer := cardinality(coalesce(p_asset_ids, '{}'::uuid[]));
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;

  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'ご相談を確認できませんでした。'; end if;
  if v_order.status not in ('awaiting_materials', 'materials_submitted', 'reviewing_materials') then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if v_order.status <> 'awaiting_materials'
     and coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved' then
    raise exception '確認済みの写真は変更できません。担当者へご連絡ください。';
  end if;
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

  if v_order.status <> 'awaiting_materials' then
    update public.orders
    set photo_analysis_status = 'pending_operator_review',
        photo_analysis_approved_at = null,
        photo_analysis_approved_by = null
    where id = p_order_id;
  end if;

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

  if v_order.status <> 'awaiting_materials' then
    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (p_order_id, auth.uid(), 'story_photos_changed', jsonb_build_object(
      'memory_id', p_memory_id,
      'primary_asset_id', p_asset_ids[1],
      'photo_count', v_photo_count,
      'photo_analysis_status', 'pending_operator_review'
    ));
  end if;
end;
$$;

create or replace function public.enforce_source_photo_edit_window()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_order_id uuid;
  v_category text;
begin
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
    v_category := old.category;
  else
    v_order_id := new.order_id;
    v_category := new.category;
  end if;
  if tg_op = 'UPDATE'
     and new.memory_id is not distinct from old.memory_id
     and new.memory_photo_sort_order is not distinct from old.memory_photo_sort_order
     and new.storage_path is not distinct from old.storage_path
     and new.original_filename is not distinct from old.original_filename
     and new.mime_type is not distinct from old.mime_type
     and new.file_size is not distinct from old.file_size
     and new.category is not distinct from old.category then
    return new;
  end if;
  if v_category <> 'source_image' or public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into v_order from public.orders where id = v_order_id;
  if not found
     or v_order.user_id <> auth.uid()
     or v_order.status not in ('awaiting_materials', 'materials_submitted', 'reviewing_materials')
     or (v_order.status <> 'awaiting_materials'
       and coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved') then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists enforce_source_photo_edit_window_trigger on public.assets;
create trigger enforce_source_photo_edit_window_trigger
before insert or update or delete on public.assets
for each row execute function public.enforce_source_photo_edit_window();

create or replace function public.admin_set_memory_primary_photo(
  p_order_id uuid,
  p_memory_id uuid,
  p_asset_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_target_position smallint;
  v_current_primary uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('materials_submitted', 'reviewing_materials') then
    raise exception 'source photos cannot be changed in current status';
  end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved' then
    raise exception 'revoke source approval before changing the primary photo';
  end if;
  if not exists (
    select 1 from public.order_memories
    where id = p_memory_id and order_id = p_order_id
  ) then raise exception 'story not found'; end if;

  select memory_photo_sort_order into v_target_position
  from public.assets
  where id = p_asset_id and order_id = p_order_id and memory_id = p_memory_id
    and category = 'source_image' and memory_photo_sort_order is not null;
  if not found then raise exception 'story photo not found'; end if;
  if v_target_position = 1 then return; end if;

  select id into v_current_primary from public.assets
  where order_id = p_order_id and memory_id = p_memory_id
    and category = 'source_image' and memory_photo_sort_order = 1;
  if not found then raise exception 'primary story photo not found'; end if;

  update public.assets set memory_photo_sort_order = null where id = p_asset_id;
  update public.assets set memory_photo_sort_order = v_target_position where id = v_current_primary;
  update public.assets set memory_photo_sort_order = 1 where id = p_asset_id;

  update public.orders
  set photo_analysis_status = 'pending_operator_review',
      photo_analysis_approved_at = null,
      photo_analysis_approved_by = null
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'story_primary_photo_changed', jsonb_build_object(
    'memory_id', p_memory_id,
    'before_asset_id', v_current_primary,
    'after_asset_id', p_asset_id
  ));
end;
$$;

create or replace function public.admin_set_photo_analysis_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before text;
  v_memory_count integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select coalesce(photo_analysis_status, 'needs_customer_input') into v_before
  from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not (
    (v_before = 'pending_operator_review' and p_status in ('approved', 'needs_customer_input'))
    or (v_before = 'needs_customer_input' and p_status = 'pending_operator_review')
    or (v_before = 'approved' and p_status = 'needs_customer_input')
  ) then raise exception 'invalid photo analysis status transition'; end if;

  if p_status = 'approved' then
    select count(*) into v_memory_count from public.order_memories where order_id = p_order_id;
    if v_memory_count <> 5 then raise exception 'five stories are required before source approval'; end if;
    if exists (
      select 1
      from public.order_memories memory
      left join public.assets asset
        on asset.memory_id = memory.id
        and asset.category = 'source_image'
        and asset.memory_photo_sort_order is not null
      where memory.order_id = p_order_id
      group by memory.id
      having count(asset.id) not between 1 and 3
    ) then raise exception 'each story requires one to three photos'; end if;
    if exists (
      select 1 from public.assets
      where order_id = p_order_id and category = 'source_image'
        and (memory_id is null or memory_photo_sort_order is null)
    ) then raise exception 'all source photos must belong to a story before approval'; end if;
  end if;

  update public.orders
  set photo_analysis_status = p_status,
      photo_analysis_approved_at = case when p_status = 'approved' then now() else null end,
      photo_analysis_approved_by = case when p_status = 'approved' then auth.uid() else null end
  where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'photo_analysis_status_changed', jsonb_build_object('before', v_before, 'after', p_status));
end;
$$;

create or replace function public.admin_publish_concepts(p_order_id uuid, p_concepts jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_story_scenes jsonb;
  v_scenes jsonb;
  v_memory_count integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if jsonb_typeof(p_concepts) <> 'array' or jsonb_array_length(p_concepts) <> 2 then raise exception 'exactly two concepts are required'; end if;
  if (select count(distinct item ->> 'slot') from jsonb_array_elements(p_concepts) item where item ->> 'slot' in ('A', 'B')) <> 2 then raise exception 'concept slots A and B are required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception '写真の運営承認が必要です。';
  end if;
  if v_order.status not in ('reviewing_materials', 'concepts_ready') then raise exception 'concepts cannot be published in current status'; end if;

  select count(*) into v_memory_count from public.order_memories where order_id = p_order_id;
  if v_memory_count <> 5 then raise exception 'exactly five stories are required'; end if;

  for v_item in select value from jsonb_array_elements(p_concepts)
  loop
    if coalesce(trim(v_item ->> 'title'), '') = ''
       or coalesce(trim(v_item ->> 'summary'), '') = ''
       or jsonb_typeof(coalesce(v_item -> 'story_scenes', 'null'::jsonb)) <> 'array' then
      raise exception 'concept title, summary and five story scenes are required';
    end if;
    if jsonb_array_length(v_item -> 'story_scenes') <> 5 then
      raise exception 'concept title, summary and five story scenes are required';
    end if;
    if (select count(distinct scene ->> 'memory_id') from jsonb_array_elements(v_item -> 'story_scenes') scene) <> 5 then
      raise exception 'each story must appear exactly once in every concept';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_item -> 'story_scenes') scene
      left join public.order_memories memory
        on memory.id::text = scene ->> 'memory_id' and memory.order_id = p_order_id
      where memory.id is null or coalesce(trim(scene ->> 'text'), '') = ''
    ) then raise exception 'every concept scene must match a submitted story and contain text'; end if;

    select
      jsonb_agg(jsonb_build_object(
        'memory_id', memory.id,
        'memory_number', memory.sort_order,
        'memory_title', memory.title,
        'text', trim(scene ->> 'text')
      ) order by memory.sort_order),
      jsonb_agg(trim(scene ->> 'text') order by memory.sort_order)
    into v_story_scenes, v_scenes
    from public.order_memories memory
    join jsonb_array_elements(v_item -> 'story_scenes') scene
      on memory.id::text = scene ->> 'memory_id'
    where memory.order_id = p_order_id;

    insert into public.concepts(order_id, slot, title, tone, summary, scenes, story_scenes, status)
    values (
      p_order_id,
      v_item ->> 'slot',
      trim(v_item ->> 'title'),
      trim(coalesce(v_item ->> 'tone', '')),
      trim(v_item ->> 'summary'),
      v_scenes,
      v_story_scenes,
      'published'
    )
    on conflict (order_id, slot) do update
    set title = excluded.title,
        tone = excluded.tone,
        summary = excluded.summary,
        scenes = excluded.scenes,
        story_scenes = excluded.story_scenes,
        status = 'published';
  end loop;

  update public.orders set status = 'concepts_ready', stage_updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'concepts_published', p_concepts);
end;
$$;

-- Keep the existing checks, but fix the required story count at five.
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
revoke all on function public.admin_set_memory_primary_photo(uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_set_memory_primary_photo(uuid, uuid, uuid) to authenticated;
revoke all on function public.admin_set_photo_analysis_status(uuid, text) from public, anon;
grant execute on function public.admin_set_photo_analysis_status(uuid, text) to authenticated;
revoke all on function public.admin_publish_concepts(uuid, jsonb) from public, anon;
grant execute on function public.admin_publish_concepts(uuid, jsonb) to authenticated;
revoke all on function public.submit_memory_order(uuid) from public, anon;
grant execute on function public.submit_memory_order(uuid) to authenticated;
