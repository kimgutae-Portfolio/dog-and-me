-- Temporary service-only diagnostic. The inner block is always rolled back,
-- so this reports the FK/trigger that blocks auth deletion without changing
-- the customer account. A following migration removes this function.

create or replace function public.diagnose_customer_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  begin
    delete from auth.users where id = p_user_id;
    raise exception using errcode = 'ZX001', message = 'diagnostic rollback';
  exception
    when sqlstate 'ZX001' then
      return jsonb_build_object('deletable', true);
    when others then
      return jsonb_build_object(
        'deletable', false,
        'sqlstate', sqlstate,
        'message', sqlerrm
      );
  end;
end;
$$;

revoke all on function public.diagnose_customer_account_deletion(uuid)
from public, anon, authenticated;
grant execute on function public.diagnose_customer_account_deletion(uuid)
to service_role;
