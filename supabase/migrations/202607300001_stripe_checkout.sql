-- Stripe-hosted Checkout. Card details never pass through WAN MEMORY.

create table if not exists public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  amount integer not null check (amount > 0),
  currency text not null check (currency = lower(currency)),
  status text not null default 'creating'
    check (status in ('creating', 'open', 'paid', 'expired', 'failed', 'refunded')),
  livemode boolean,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stripe_checkout_one_active_order_idx
  on public.stripe_checkout_sessions(order_id)
  where status in ('creating', 'open');
create index if not exists stripe_checkout_order_created_idx
  on public.stripe_checkout_sessions(order_id, created_at desc);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_checkout_sessions enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_checkout_sessions from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_checkout_sessions to service_role;
grant all on public.stripe_webhook_events to service_role;

create or replace function public.process_stripe_checkout_completed(
  p_event_id text,
  p_event_type text,
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_currency text,
  p_livemode boolean
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_checkout public.stripe_checkout_sessions%rowtype;
  v_order public.orders%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if exists (select 1 from public.stripe_webhook_events where event_id = p_event_id) then return false; end if;

  select * into v_checkout
  from public.stripe_checkout_sessions
  where stripe_session_id = p_stripe_session_id
  for update;
  if not found then raise exception 'checkout session not found'; end if;
  if v_checkout.amount <> p_amount_total
     or lower(v_checkout.currency) <> lower(p_currency)
     or v_checkout.livemode is distinct from p_livemode then
    raise exception 'checkout verification failed';
  end if;

  select * into v_order from public.orders where id = v_checkout.order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.user_id <> v_checkout.user_id
     or v_order.quoted_price <> p_amount_total
     or lower(v_order.currency) <> lower(p_currency) then
    raise exception 'order payment verification failed';
  end if;

  update public.stripe_checkout_sessions
  set stripe_payment_intent_id = p_payment_intent_id,
      status = 'paid',
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_checkout.id;

  if v_order.payment_status <> 'paid' then
    update public.orders
    set payment_status = 'paid', updated_at = now()
    where id = v_order.id;

    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (
      v_order.id,
      null,
      'stripe_payment_completed',
      jsonb_build_object(
        'stripe_session_id', p_stripe_session_id,
        'payment_intent_id', p_payment_intent_id,
        'amount', p_amount_total,
        'currency', lower(p_currency),
        'livemode', p_livemode
      )
    );
  end if;

  insert into public.stripe_webhook_events(event_id, event_type)
  values (p_event_id, p_event_type);
  return true;
end;
$$;

create or replace function public.process_stripe_checkout_closed(
  p_event_id text,
  p_event_type text,
  p_stripe_session_id text,
  p_status text
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_checkout public.stripe_checkout_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_status not in ('expired', 'failed') then raise exception 'invalid checkout status'; end if;
  if exists (select 1 from public.stripe_webhook_events where event_id = p_event_id) then return false; end if;

  select * into v_checkout
  from public.stripe_checkout_sessions
  where stripe_session_id = p_stripe_session_id
  for update;
  if not found then raise exception 'checkout session not found'; end if;

  if v_checkout.status <> 'paid' then
    update public.stripe_checkout_sessions
    set status = p_status, updated_at = now()
    where id = v_checkout.id;
  end if;

  insert into public.stripe_webhook_events(event_id, event_type)
  values (p_event_id, p_event_type);
  return true;
end;
$$;

create or replace function public.process_stripe_refund(
  p_event_id text,
  p_event_type text,
  p_payment_intent_id text,
  p_amount_refunded integer,
  p_full_refund boolean
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_checkout public.stripe_checkout_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if exists (select 1 from public.stripe_webhook_events where event_id = p_event_id) then return false; end if;

  select * into v_checkout
  from public.stripe_checkout_sessions
  where stripe_payment_intent_id = p_payment_intent_id
  for update;
  if not found then raise exception 'payment intent not found'; end if;

  if p_full_refund then
    update public.stripe_checkout_sessions
    set status = 'refunded', refunded_at = now(), updated_at = now()
    where id = v_checkout.id;
    update public.orders set payment_status = 'refunded', updated_at = now()
    where id = v_checkout.order_id;
  end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    v_checkout.order_id,
    null,
    case when p_full_refund then 'stripe_payment_refunded' else 'stripe_payment_partially_refunded' end,
    jsonb_build_object(
      'payment_intent_id', p_payment_intent_id,
      'amount_refunded', p_amount_refunded,
      'full_refund', p_full_refund
    )
  );

  insert into public.stripe_webhook_events(event_id, event_type)
  values (p_event_id, p_event_type);
  return true;
end;
$$;

revoke all on function public.process_stripe_checkout_completed(text, text, text, text, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.process_stripe_checkout_closed(text, text, text, text) from public, anon, authenticated;
revoke all on function public.process_stripe_refund(text, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.process_stripe_checkout_completed(text, text, text, text, integer, text, boolean) to service_role;
grant execute on function public.process_stripe_checkout_closed(text, text, text, text) to service_role;
grant execute on function public.process_stripe_refund(text, text, text, integer, boolean) to service_role;

-- Administrators may request payment, but only a verified Stripe webhook may
-- mark an order paid/refunded or downgrade a completed payment.
create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status text,
  p_payment_status text,
  p_due_date date,
  p_admin_notes text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_before from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not public.is_valid_order_transition(v_before.status, p_status) then
    raise exception 'invalid order status transition: % -> %', v_before.status, p_status;
  end if;
  if p_payment_status not in ('pending', 'invoice_sent', 'paid', 'refunded') then
    raise exception 'invalid payment status';
  end if;
  if p_payment_status is distinct from v_before.payment_status then
    if p_payment_status in ('paid', 'refunded') then
      raise exception 'payment completion and refunds are managed by Stripe';
    end if;
    if v_before.payment_status in ('paid', 'refunded') then
      raise exception 'completed payment status cannot be changed manually';
    end if;
  end if;
  if p_payment_status = 'invoice_sent'
     and (p_status <> 'concept_selected'
       or v_before.selected_concept_slot is null
       or not public.order_has_current_consents(p_order_id)) then
    raise exception 'concept selection and current consent are required before payment request';
  end if;
  if p_status in ('stills_review', 'production', 'customer_review', 'revision_requested', 'quality_check')
     and p_payment_status <> 'paid' then
    raise exception 'payment must be confirmed before production';
  end if;
  if p_status in ('stills_review', 'production', 'customer_review', 'revision_requested', 'quality_check')
     and not public.order_has_current_consents(p_order_id) then
    raise exception 'current consent record required before production';
  end if;
  if p_status = 'quality_check' and exists (
    select 1 from public.revision_requests where order_id = p_order_id and status = 'open'
  ) then raise exception 'open revision must be resolved'; end if;

  update public.orders
  set status = p_status,
      payment_status = p_payment_status,
      due_date = p_due_date,
      admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
      customer_approved_at = case when status = 'quality_check' and p_status <> 'quality_check' then null else customer_approved_at end,
      customer_approved_by = case when status = 'quality_check' and p_status <> 'quality_check' then null else customer_approved_by end,
      customer_approved_review_asset_id = case when status = 'quality_check' and p_status <> 'quality_check' then null else customer_approved_review_asset_id end,
      stills_approved_at = case when status = 'stills_review' and p_status = 'concept_selected' then null else stills_approved_at end,
      stills_approved_by = case when status = 'stills_review' and p_status = 'concept_selected' then null else stills_approved_by end,
      stage_updated_at = case when status is distinct from p_status then now() else stage_updated_at end
  where id = p_order_id;

  if v_before.status is distinct from p_status
     or v_before.payment_status is distinct from p_payment_status
     or v_before.due_date is distinct from p_due_date
     or v_before.admin_notes is distinct from nullif(trim(coalesce(p_admin_notes, '')), '') then
    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (
      p_order_id,
      auth.uid(),
      case
        when v_before.payment_status <> 'invoice_sent' and p_payment_status = 'invoice_sent'
          then 'stripe_payment_requested'
        else 'admin_order_updated'
      end,
      jsonb_build_object(
        'before', jsonb_build_object('status', v_before.status, 'payment_status', v_before.payment_status, 'due_date', v_before.due_date),
        'after', jsonb_build_object('status', p_status, 'payment_status', p_payment_status, 'due_date', p_due_date),
        'admin_notes_changed', v_before.admin_notes is distinct from nullif(trim(coalesce(p_admin_notes, '')), '')
      )
    );
  end if;
end;
$$;
