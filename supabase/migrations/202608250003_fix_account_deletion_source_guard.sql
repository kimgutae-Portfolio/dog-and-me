-- Account deletion is a trusted service operation, not a customer photo edit.
-- Let the service role remove source photos, then remove every asset before the
-- Auth Admin API cascades through the customer's remaining public records.

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

  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
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

create or replace function public.prepare_customer_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then raise exception 'profile not found'; end if;
  if v_profile.role <> 'customer' then
    raise exception 'customer account required';
  end if;

  delete from public.deliveries
  where order_id in (
    select id from public.orders where user_id = p_user_id
  );

  update public.assets
  set source_still_asset_id = null
  where order_id in (
    select id from public.orders where user_id = p_user_id
  ) and source_still_asset_id is not null;

  delete from public.assets
  where order_id in (
    select id from public.orders where user_id = p_user_id
  );

  delete from public.security_events
  where actor_id = p_user_id or target_user_id = p_user_id;

  delete from public.deleted_order_log
  where lower(customer_email) = lower(v_profile.email);
end;
$$;

revoke all on function public.prepare_customer_account_deletion(uuid)
from public, anon, authenticated;
grant execute on function public.prepare_customer_account_deletion(uuid)
to service_role;

drop function if exists public.diagnose_customer_account_deletion(uuid);
