-- An administrator may reopen source-photo editing for one customer at any
-- payment or production status. Any actual change invalidates the previous
-- STORY SOURCE REVIEW approval, and the permission closes on re-approval.

alter table public.orders
  add column if not exists source_photo_change_open boolean not null default false,
  add column if not exists source_photo_change_opened_at timestamptz,
  add column if not exists source_photo_change_opened_by uuid references public.profiles(id) on delete set null;

create or replace function public.enforce_source_approval_freeze()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(old.photo_analysis_status, 'needs_customer_input') = 'approved'
     and new.photo_analysis_status is distinct from old.photo_analysis_status
     and not coalesce(old.source_photo_change_open, false) then
    raise exception 'STORY SOURCE REVIEW approval cannot be revoked without administrator photo-change permission';
  end if;
  return new;
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
  if v_category <> 'source_image' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into v_order from public.orders where id = v_order_id;
  if not found then raise exception '現在の制作工程では写真を変更できません。'; end if;
  if public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if v_order.user_id <> auth.uid() then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if coalesce(v_order.source_photo_change_open, false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved'
     or v_order.status not in ('awaiting_materials', 'materials_submitted', 'reviewing_materials') then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
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
  v_special_permission boolean;
begin
  if auth.uid() is null then raise exception 'ログイン情報を確認できませんでした。'; end if;

  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'ご相談を確認できませんでした。'; end if;
  v_special_permission := coalesce(v_order.source_photo_change_open, false);
  if not v_special_permission
     and v_order.status not in ('awaiting_materials', 'materials_submitted', 'reviewing_materials') then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if not v_special_permission
     and v_order.status <> 'awaiting_materials'
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

  if v_order.status <> 'awaiting_materials' or v_special_permission then
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

  if v_order.status <> 'awaiting_materials' or v_special_permission then
    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (p_order_id, auth.uid(), 'story_photos_changed', jsonb_build_object(
      'memory_id', p_memory_id,
      'primary_asset_id', p_asset_ids[1],
      'photo_count', v_photo_count,
      'photo_analysis_status', 'pending_operator_review',
      'administrator_permission', v_special_permission
    ));
  end if;
end;
$$;

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
  if not coalesce(v_order.source_photo_change_open, false)
     and v_order.status not in ('materials_submitted', 'reviewing_materials') then
    raise exception 'source photos cannot be changed in current status';
  end if;
  if not coalesce(v_order.source_photo_change_open, false)
     and coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved' then
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
    'after_asset_id', p_asset_id,
    'administrator_permission', coalesce(v_order.source_photo_change_open, false)
  ));
end;
$$;

create or replace function public.admin_set_source_photo_change_open(
  p_order_id uuid,
  p_open boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before boolean;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select coalesce(source_photo_change_open, false) into v_before
  from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  update public.orders
  set source_photo_change_open = p_open,
      source_photo_change_opened_at = case when p_open then now() else null end,
      source_photo_change_opened_by = case when p_open then auth.uid() else null end
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    case when p_open then 'source_photo_change_opened' else 'source_photo_change_closed' end,
    jsonb_build_object('before', v_before, 'after', p_open)
  );
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
  if v_before = 'approved' then
    raise exception 'Use the photo-change permission control to reopen approved sources';
  end if;
  if not (
    (v_before = 'pending_operator_review' and p_status in ('approved', 'needs_customer_input'))
    or (v_before = 'needs_customer_input' and p_status = 'pending_operator_review')
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
      photo_analysis_approved_by = case when p_status = 'approved' then auth.uid() else null end,
      source_photo_change_open = case when p_status = 'approved' then false else source_photo_change_open end,
      source_photo_change_opened_at = case when p_status = 'approved' then null else source_photo_change_opened_at end,
      source_photo_change_opened_by = case when p_status = 'approved' then null else source_photo_change_opened_by end
  where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'photo_analysis_status_changed', jsonb_build_object(
    'before', v_before,
    'after', p_status,
    'photo_change_permission_closed', p_status = 'approved'
  ));
end;
$$;

revoke all on function public.assign_memory_photos(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.assign_memory_photos(uuid, uuid, uuid[]) to authenticated;
revoke all on function public.admin_set_memory_primary_photo(uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_set_memory_primary_photo(uuid, uuid, uuid) to authenticated;
revoke all on function public.admin_set_source_photo_change_open(uuid, boolean) from public, anon;
grant execute on function public.admin_set_source_photo_change_open(uuid, boolean) to authenticated;
revoke all on function public.admin_set_photo_analysis_status(uuid, text) from public, anon;
grant execute on function public.admin_set_photo_analysis_status(uuid, text) to authenticated;
