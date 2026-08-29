-- Lower the launch monitor price to ¥12,800 and the regular price to ¥14,800.
-- Orders that have already been submitted keep their quoted price. Unsubmitted,
-- unpaid drafts follow the new regular price, and all earlier monitor campaigns
-- remain in the count so the twenty-order limit is not reset.

alter table public.orders alter column regular_price set default 14800;

update public.orders
set quoted_price = 14800,
    regular_price = 14800
where status = 'awaiting_materials'
  and payment_status = 'unpaid';

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
  with counts as (
    select count(*)::integer as used
    from public.orders
    where campaign_id in (
      'launch-monitor-19800-10',
      'launch-monitor-16800-10',
      'launch-monitor-16800-20',
      'launch-monitor-12800-20'
    )
      and status not in ('awaiting_materials', 'cancelled')
  )
  select
    case when used < 20 then 12800 else 14800 end,
    14800,
    20,
    used,
    greatest(20 - used, 0),
    used < 20
  from counts;
$$;

do $$
declare
  v_function_oid oid;
  v_definition text;
begin
  select p.oid into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_memory_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_data jsonb';

  if v_function_oid is null then
    raise exception 'create_memory_order(jsonb) was not found';
  end if;
  v_definition := pg_get_functiondef(v_function_oid);
  if position('v_regular_price integer := 19800;' in v_definition) = 0 then
    raise exception 'expected create_memory_order regular price was not found';
  end if;
  execute replace(
    v_definition,
    'v_regular_price integer := 19800;',
    'v_regular_price integer := 14800;'
  );

  select p.oid into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_memory_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_order_id uuid';

  if v_function_oid is null then
    raise exception 'submit_memory_order(uuid) was not found';
  end if;
  v_definition := pg_get_functiondef(v_function_oid);
  if position('hashtext(''wan-memory-launch-monitor-16800-20'')' in v_definition) = 0
     or position('v_price := 16800;' in v_definition) = 0
     or position('v_campaign := ''launch-monitor-16800-20'';' in v_definition) = 0 then
    raise exception 'expected current launch pricing was not found';
  end if;
  v_definition := replace(
    v_definition,
    'hashtext(''wan-memory-launch-monitor-16800-20'')',
    'hashtext(''wan-memory-launch-monitor-12800-20'')'
  );
  v_definition := replace(
    v_definition,
    'where campaign_id in (''launch-monitor-19800-10'', ''launch-monitor-16800-10'', ''launch-monitor-16800-20'')',
    'where campaign_id in (''launch-monitor-19800-10'', ''launch-monitor-16800-10'', ''launch-monitor-16800-20'', ''launch-monitor-12800-20'')'
  );
  v_definition := replace(
    v_definition,
    'v_price := 16800;',
    'v_price := 12800;'
  );
  v_definition := replace(
    v_definition,
    'v_campaign := ''launch-monitor-16800-20'';',
    'v_campaign := ''launch-monitor-12800-20'';'
  );
  execute v_definition;
end;
$$;

revoke all on function public.get_memory_film_pricing() from public;
grant execute on function public.get_memory_film_pricing() to anon, authenticated;
