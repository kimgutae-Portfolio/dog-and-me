-- Support for the floating chat widget: track when the recipient has seen a
-- message, and let clients receive new messages live instead of only on the
-- next explicit reload.

alter table public.messages add column if not exists read_at timestamptz;

create or replace function public.mark_order_messages_read(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (
    public.is_admin() or exists (
      select 1 from public.orders where id = p_order_id and user_id = auth.uid()
    )
  ) then
    raise exception 'not authorized for this order';
  end if;

  update public.messages
  set read_at = now()
  where order_id = p_order_id
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_order_messages_read(uuid) from public;
grant execute on function public.mark_order_messages_read(uuid) to authenticated;

alter publication supabase_realtime add table public.messages;
