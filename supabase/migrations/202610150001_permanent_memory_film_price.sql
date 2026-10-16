-- Permanent standard price: ¥12,800 (tax included), with no launch quota.
-- Keep the pricing RPC's return shape for older clients, but retire all launch
-- counters. Patch only the price-specific portions of the current order RPCs
-- so subsequent consent/revision fixes are not replaced by an old snapshot.
begin;

-- Apply during a brief checkout maintenance window. A previously issued Stripe
-- session must never be repriced underneath a customer or a delayed webhook.
lock table public.stripe_checkout_sessions, public.orders in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.orders orders
    join public.stripe_checkout_sessions checkout on checkout.order_id = orders.id
    where orders.payment_status in ('pending', 'invoice_sent')
      and orders.status not in ('cancelled', 'delivered')
      and orders.quoted_price > 12800
      and (orders.campaign_id is null or orders.campaign_id like 'launch-monitor-%')
      and checkout.status in ('creating', 'open', 'paid', 'refunded')
  ) then
    raise exception 'Resolve existing higher-priced Stripe sessions before applying permanent pricing. Expire unpaid sessions in Stripe and confirm their DB status; process paid/refunded webhooks first.';
  end if;
end;
$$;

alter table public.orders alter column regular_price set default 12800;

create or replace function public.get_memory_film_pricing()
returns table(
  current_price integer,
  regular_price integer,
  launch_limit integer,
  launch_used integer,
  launch_remaining integer,
  campaign_active boolean
)
language sql
stable
security definer set search_path = public
as $$
  select 12800, 12800, 0, 0, 0, false;
$$;

do $migration$
declare
  v_definition text;
  v_launch_pricing text := $old$  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-12800-20'));
  select count(*)::integer into v_launch_count from public.orders
  where campaign_id in ('launch-monitor-19800-10', 'launch-monitor-16800-10', 'launch-monitor-16800-20', 'launch-monitor-12800-20')
    and status not in ('awaiting_materials', 'cancelled');
  if v_launch_count < 20 then
    v_price := 12800;
    v_campaign := 'launch-monitor-12800-20';
  else
    v_price := v_order.regular_price;
    v_campaign := null;
  end if;$old$;
begin
  v_definition := pg_get_functiondef('public.create_memory_order(jsonb)'::regprocedure);
  if position('v_regular_price integer := 14800;' in v_definition) = 0 then
    raise exception 'Expected current create_memory_order price was not found';
  end if;
  execute replace(v_definition,
    'v_regular_price integer := 14800;',
    'v_regular_price integer := 12800;'
  );

  v_definition := pg_get_functiondef('public.submit_memory_order(uuid)'::regprocedure);
  if position(v_launch_pricing in v_definition) = 0
     or position('  v_launch_count integer;' in v_definition) = 0
     or position('      quoted_price = v_price,' in v_definition) = 0 then
    raise exception 'Expected current submit_memory_order launch pricing was not found';
  end if;
  v_definition := replace(v_definition, '  v_launch_count integer;' || chr(10), '');
  v_definition := replace(v_definition, v_launch_pricing, $new$  if v_order.payment_status not in ('pending', 'invoice_sent')
     or v_order.campaign_id = 'complimentary' then
    raise exception 'Only unpaid standard orders can be submitted.';
  end if;
  v_price := 12800;
  v_campaign := null;$new$);
  v_definition := replace(v_definition,
    '      quoted_price = v_price,',
    '      quoted_price = v_price,' || chr(10) || '      regular_price = v_price,'
  );
  execute v_definition;
end;
$migration$;

-- Existing unpaid standard/launch quotes at or above the permanent price follow
-- the new price too. Do not raise a lower individually agreed quote, or rewrite
-- paid/refunded, complimentary, delivered, cancelled, or custom-campaign records.
with previous as (
  select id, quoted_price, regular_price, campaign_id
  from public.orders
  where payment_status in ('pending', 'invoice_sent')
    and status not in ('cancelled', 'delivered')
    and quoted_price >= 12800
    and (campaign_id is null or campaign_id like 'launch-monitor-%')
    and (quoted_price <> 12800 or regular_price <> 12800 or campaign_id is not null)
), updated as (
  update public.orders orders
  set quoted_price = 12800, regular_price = 12800, campaign_id = null
  from previous
  where orders.id = previous.id
  returning orders.id, previous.quoted_price, previous.regular_price, previous.campaign_id
)
insert into public.order_events(order_id, actor_id, event_type, payload)
select id, null, 'standard_price_updated', jsonb_build_object(
  'previous_quoted_price', quoted_price,
  'previous_regular_price', regular_price,
  'previous_campaign_id', campaign_id,
  'quoted_price', 12800,
  'regular_price', 12800,
  'reason', 'permanent_standard_price_2026_10_15'
)
from updated;

revoke all on function public.get_memory_film_pricing() from public;
grant execute on function public.get_memory_film_pricing() to anon, authenticated;
revoke all on function public.create_memory_order(jsonb) from public, anon;
grant execute on function public.create_memory_order(jsonb) to authenticated;
revoke all on function public.submit_memory_order(uuid) from public, anon;
grant execute on function public.submit_memory_order(uuid) to authenticated;

commit;
