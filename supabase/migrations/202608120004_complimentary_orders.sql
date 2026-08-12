-- Free-of-charge orders (friends, gifts, review copies) that never go through
-- Stripe at all.
--
-- The Stripe path verifies that the amount Stripe charged matches the amount we
-- quoted (process_stripe_checkout_completed), which is what makes a tampered
-- checkout impossible. Rather than loosen that check so a 100%-off coupon can
-- pass through it, a comped order gets its own explicit, admin-only, audited
-- path and the Stripe verification stays exactly as strict as it is today.

create or replace function public.admin_grant_complimentary_order(
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if v_reason is null then raise exception 'complimentary reason required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  if v_order.payment_status not in ('pending', 'invoice_sent') then
    raise exception 'only unpaid orders can be made complimentary';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'cancelled orders cannot be made complimentary';
  end if;
  -- submit_memory_order rewrites quoted_price and campaign_id when the customer
  -- submits, which would silently undo this. Only comp a submitted order.
  if v_order.status = 'awaiting_materials' then
    raise exception 'wait until the customer submits the order';
  end if;

  update public.orders
  set payment_status = 'paid',
      quoted_price = 0,
      -- Keeps the free order out of the launch campaign count, which matches on
      -- campaign_id = 'launch-monitor-19800-10', and labels it in the admin list.
      campaign_id = 'complimentary'
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_marked_complimentary', jsonb_build_object(
    'reason', v_reason,
    'original_quoted_price', v_order.quoted_price,
    'previous_payment_status', v_order.payment_status
  ));
end;
$$;

revoke all on function public.admin_grant_complimentary_order(uuid, text) from public, anon;
grant execute on function public.admin_grant_complimentary_order(uuid, text) to authenticated;
