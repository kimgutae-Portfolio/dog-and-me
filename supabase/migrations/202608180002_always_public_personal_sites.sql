-- Delivered personal sites are always available. Customers no longer manage a
-- separate public/private state or rotate an already-issued personal URL.

alter table public.share_links
  alter column active set default true;

update public.share_links
set active = true
where not active;

create or replace function public.manage_memory_share(
  p_order_id uuid,
  p_action text default 'get'
)
returns table(token text, active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select user_id into v_owner_id from public.orders where id = p_order_id;

  if v_owner_id is null or (v_owner_id <> auth.uid() and not public.is_admin()) then
    raise exception 'not allowed';
  end if;

  -- Keep the legacy action argument for older clients, but intentionally do
  -- not disable or rotate the permanent personal URL.
  if p_action not in ('get', 'enable', 'disable', 'rotate') then
    raise exception 'invalid action';
  end if;

  insert into public.share_links (order_id, user_id, active)
  values (p_order_id, v_owner_id, true)
  on conflict (order_id) do update
  set active = true;

  return query
  select link.token, true
  from public.share_links as link
  where link.order_id = p_order_id;
end;
$$;

revoke all on function public.manage_memory_share(uuid, text) from public;
grant execute on function public.manage_memory_share(uuid, text) to authenticated;
