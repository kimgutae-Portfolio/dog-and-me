-- STORY SOURCE REVIEW approval is the final source-photo cutoff. Once an
-- order is approved, neither customers nor operators can reopen or mutate its
-- source-photo set through application roles.

create or replace function public.enforce_source_approval_freeze()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(old.photo_analysis_status, 'needs_customer_input') = 'approved'
     and new.photo_analysis_status is distinct from old.photo_analysis_status then
    raise exception 'STORY SOURCE REVIEW approval cannot be revoked';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_source_approval_freeze_trigger on public.orders;
create trigger enforce_source_approval_freeze_trigger
before update of photo_analysis_status on public.orders
for each row execute function public.enforce_source_approval_freeze();

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
  if not found then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved' then
    raise exception '承認済みの制作素材は変更できません。';
  end if;
  if public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if v_order.user_id <> auth.uid()
     or v_order.status not in ('awaiting_materials', 'materials_submitted', 'reviewing_materials') then
    raise exception '現在の制作工程では写真を変更できません。';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
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
    raise exception 'STORY SOURCE REVIEW approval cannot be revoked';
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
      photo_analysis_approved_by = case when p_status = 'approved' then auth.uid() else null end
  where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'photo_analysis_status_changed', jsonb_build_object('before', v_before, 'after', p_status));
end;
$$;

revoke all on function public.admin_set_photo_analysis_status(uuid, text) from public, anon;
grant execute on function public.admin_set_photo_analysis_status(uuid, text) to authenticated;
