-- Prepare a customer account for hard deletion through the Supabase Admin API.
-- The Admin API removes auth.users; profile-owned records then cascade away.
-- Restrictive asset references and detached audit rows are cleaned first.

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

  -- These rows otherwise survive with a nulled user reference. Removing them
  -- prevents a newly registered account from having any WAN MEMORY history.
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
