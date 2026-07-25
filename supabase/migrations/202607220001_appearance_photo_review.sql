-- Keep the customer's chosen appearance references separate from scene photos,
-- and require an operator review before concepts or production can begin.

alter table public.orders
  add column if not exists primary_face_photo_id uuid references public.assets(id) on delete set null,
  add column if not exists primary_body_photo_id uuid references public.assets(id) on delete set null,
  add column if not exists side_tail_photo_id uuid references public.assets(id) on delete set null,
  add column if not exists appearance_policy text,
  add column if not exists selected_appearance_description text,
  add column if not exists selected_appearance_photo_ids uuid[],
  add column if not exists owner_locked_traits text[],
  add column if not exists ai_reconstruction_acknowledged boolean,
  add column if not exists photo_analysis_status text,
  add column if not exists photo_analysis_approved_at timestamptz,
  add column if not exists photo_analysis_approved_by uuid references public.profiles(id) on delete set null;

alter table public.orders
  drop constraint if exists orders_appearance_policy_check,
  add constraint orders_appearance_policy_check check (
    appearance_policy is null or appearance_policy in ('photo_era_by_scene', 'current_appearance', 'selected_period')
  ),
  drop constraint if exists orders_selected_appearance_description_check,
  add constraint orders_selected_appearance_description_check check (
    selected_appearance_description is null
    or char_length(trim(selected_appearance_description)) between 1 and 200
  ),
  drop constraint if exists orders_owner_locked_traits_check,
  add constraint orders_owner_locked_traits_check check (
    owner_locked_traits is null or cardinality(owner_locked_traits) between 0 and 3
  ),
  drop constraint if exists orders_photo_analysis_status_check,
  add constraint orders_photo_analysis_status_check check (
    photo_analysis_status is null or photo_analysis_status in (
      'not_started', 'ai_analysis_complete', 'pending_operator_review', 'approved', 'needs_customer_input'
    )
  );

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
  if cardinality(coalesce(p_asset_ids, '{}'::uuid[])) not between 1 and 5 then
    raise exception '各思い出に写真を1〜5枚選んでください。';
  end if;
  if not exists (
    select 1 from public.order_memories
    where id = p_memory_id and order_id = p_order_id and user_id = auth.uid()
  ) then raise exception '保存した思い出を確認できませんでした。'; end if;
  if cardinality(p_asset_ids) <> (select count(distinct photo_id) from unnest(p_asset_ids) as photo_id) then
    raise exception '同じ写真を重複して選ぶことはできません。';
  end if;
  if (select count(distinct photo_id) from unnest(p_asset_ids) as photo_id) <> (
    select count(*) from public.assets
    where id = any(p_asset_ids) and order_id = p_order_id
      and user_id = auth.uid() and category = 'source_image'
  ) then raise exception '思い出に選んだ写真を確認できませんでした。'; end if;
  if exists (
    select 1 from public.assets
    where id = any(p_asset_ids) and memory_id is not null and memory_id <> p_memory_id
  ) then raise exception '同じ写真は1つの思い出にだけ設定してください。'; end if;

  update public.assets
  set memory_id = null
  where order_id = p_order_id and user_id = auth.uid()
    and memory_id = p_memory_id and category = 'source_image'
    and not (id = any(p_asset_ids));
  update public.assets
  set memory_id = p_memory_id
  where id = any(p_asset_ids) and order_id = p_order_id
    and user_id = auth.uid() and category = 'source_image';
end;
$$;

create or replace function public.clear_deleted_appearance_reference()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.orders
  set selected_appearance_photo_ids = array_remove(coalesce(selected_appearance_photo_ids, '{}'::uuid[]), old.id)
  where old.id = any(coalesce(selected_appearance_photo_ids, '{}'::uuid[]));
  return old;
end;
$$;

drop trigger if exists clear_deleted_appearance_reference_trigger on public.assets;
create trigger clear_deleted_appearance_reference_trigger
after delete on public.assets
for each row execute function public.clear_deleted_appearance_reference();

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
    group by m.id having count(a.id) not between 1 and 5
  ) invalid_memories;
  if v_invalid_memory_count > 0 then raise exception '各思い出に写真を1〜5枚選んでください。'; end if;
  select count(*)::integer into v_photo_count from public.assets a
  join public.order_memories m on m.id = a.memory_id
  where a.order_id = p_order_id and a.user_id = auth.uid() and a.category = 'source_image';
  if v_photo_count < 5 then raise exception '思い出に使う写真を合計5枚以上選んでください。'; end if;

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

create or replace function public.admin_set_photo_analysis_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before text;
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

  update public.orders
  set photo_analysis_status = p_status,
      photo_analysis_approved_at = case when p_status = 'approved' then now() else null end,
      photo_analysis_approved_by = case when p_status = 'approved' then auth.uid() else null end
  where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'photo_analysis_status_changed', jsonb_build_object('before', v_before, 'after', p_status));
end;
$$;

create or replace function public.enforce_photo_analysis_before_production()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('concepts_ready', 'concept_selected', 'production', 'customer_review', 'revision_requested', 'quality_check', 'delivered')
     and coalesce(new.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception '사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_photo_analysis_before_production_trigger on public.orders;
create trigger enforce_photo_analysis_before_production_trigger
before update of status on public.orders
for each row execute function public.enforce_photo_analysis_before_production();

create or replace function public.admin_publish_concepts(p_order_id uuid, p_concepts jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if jsonb_typeof(p_concepts) <> 'array' or jsonb_array_length(p_concepts) <> 2 then raise exception 'exactly two concepts are required'; end if;
  if (select count(distinct item ->> 'slot') from jsonb_array_elements(p_concepts) item where item ->> 'slot' in ('A', 'B')) <> 2 then raise exception 'concept slots A and B are required'; end if;
  if exists (select 1 from jsonb_array_elements(p_concepts) item
    where coalesce(trim(item ->> 'title'), '') = '' or coalesce(trim(item ->> 'summary'), '') = ''
      or jsonb_typeof(coalesce(item -> 'scenes', '[]'::jsonb)) <> 'array') then
    raise exception 'concept title, summary and scene array are required';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception '사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.';
  end if;
  if v_order.status not in ('reviewing_materials', 'concepts_ready') then raise exception 'concepts cannot be published in current status'; end if;

  insert into public.concepts(order_id, slot, title, tone, summary, scenes, status)
  select p_order_id, item ->> 'slot', trim(item ->> 'title'), trim(coalesce(item ->> 'tone', '')),
    trim(item ->> 'summary'), coalesce(item -> 'scenes', '[]'::jsonb), 'published'
  from jsonb_array_elements(p_concepts) item
  on conflict (order_id, slot) do update
  set title = excluded.title, tone = excluded.tone, summary = excluded.summary,
      scenes = excluded.scenes, status = 'published';
  update public.orders set status = 'concepts_ready', stage_updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'concepts_published', p_concepts);
end;
$$;

revoke all on function public.save_order_production_fields(uuid, jsonb) from public, anon;
revoke all on function public.assign_memory_photos(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.admin_set_photo_analysis_status(uuid, text) from public, anon;
revoke all on function public.submit_memory_order(uuid) from public, anon;
revoke all on function public.admin_publish_concepts(uuid, jsonb) from public, anon;
grant execute on function public.save_order_production_fields(uuid, jsonb) to authenticated;
grant execute on function public.assign_memory_photos(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.admin_set_photo_analysis_status(uuid, text) to authenticated;
grant execute on function public.submit_memory_order(uuid) to authenticated;
grant execute on function public.admin_publish_concepts(uuid, jsonb) to authenticated;

-- Customer-facing code uses neutral share-code terminology. The existing
-- database functions remain available for backward compatibility.
create or replace function public.manage_memory_site(p_order_id uuid, p_action text)
returns table(code text, active boolean)
language sql
security definer set search_path = public
as $$
  select result.token as code, result.active
  from public.manage_memory_share(p_order_id, p_action) result;
$$;

create or replace function public.get_shared_memory_by_code(p_share_code text)
returns jsonb
language sql
security definer set search_path = public
as $$
  select public.get_shared_memory(p_share_code);
$$;

revoke all on function public.manage_memory_site(uuid, text) from public, anon;
revoke all on function public.get_shared_memory_by_code(text) from public;
grant execute on function public.manage_memory_site(uuid, text) to authenticated;
grant execute on function public.get_shared_memory_by_code(text) to anon, authenticated;
