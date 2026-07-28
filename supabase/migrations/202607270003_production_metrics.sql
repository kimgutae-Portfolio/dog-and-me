-- Minimal internal metrics for the first ten manual productions. These values
-- are never exposed to customers and allow pricing and capacity decisions to
-- be based on real work rather than estimates.

alter table public.orders
  add column if not exists production_started_at timestamptz,
  add column if not exists production_completed_at timestamptz,
  add column if not exists production_work_minutes integer not null default 0,
  add column if not exists runway_credits_used integer not null default 0,
  add column if not exists runway_generation_count integer not null default 0,
  add column if not exists runway_retry_count integer not null default 0,
  add column if not exists production_log text;

alter table public.orders
  drop constraint if exists orders_production_metrics_nonnegative,
  add constraint orders_production_metrics_nonnegative check (
    production_work_minutes >= 0
    and runway_credits_used >= 0
    and runway_generation_count >= 0
    and runway_retry_count >= 0
  );

create or replace function public.admin_save_production_metrics(
  p_order_id uuid,
  p_work_minutes integer,
  p_runway_credits integer,
  p_generation_count integer,
  p_retry_count integer,
  p_notes text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if coalesce(p_work_minutes, -1) < 0 or coalesce(p_runway_credits, -1) < 0
    or coalesce(p_generation_count, -1) < 0 or coalesce(p_retry_count, -1) < 0 then
    raise exception 'production metrics must be nonnegative';
  end if;
  if char_length(coalesce(p_notes, '')) > 3000 then raise exception 'production note is too long'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  update public.orders
  set production_work_minutes = p_work_minutes,
      runway_credits_used = p_runway_credits,
      runway_generation_count = p_generation_count,
      runway_retry_count = p_retry_count,
      production_log = nullif(trim(p_notes), ''),
      production_started_at = case
        when p_work_minutes > 0 or p_generation_count > 0 then coalesce(v_order.production_started_at, now())
        else v_order.production_started_at
      end,
      production_completed_at = case
        when v_order.status in ('customer_review', 'quality_check', 'delivered')
          and (p_work_minutes > 0 or p_generation_count > 0) then now()
        else v_order.production_completed_at
      end,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'production_metrics_saved', jsonb_build_object(
    'work_minutes', p_work_minutes,
    'runway_credits', p_runway_credits,
    'generation_count', p_generation_count,
    'retry_count', p_retry_count,
    'has_notes', nullif(trim(p_notes), '') is not null
  ));
end;
$$;

revoke all on function public.admin_save_production_metrics(uuid, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.admin_save_production_metrics(uuid, integer, integer, integer, integer, text) to authenticated;
