-- Lower the public price for new consultations while preserving prices that
-- customers have already been quoted. Existing drafts follow the new price.

alter table public.orders alter column regular_price set default 19800;

update public.orders
set quoted_price = 19800,
    regular_price = 19800
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
      'launch-monitor-16800-10'
    )
      and status not in ('awaiting_materials', 'cancelled')
  )
  select
    case when used < 10 then 16800 else 19800 end,
    19800,
    10,
    used,
    greatest(10 - used, 0),
    used < 10
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
  if position('v_regular_price integer := 24800;' in v_definition) = 0 then
    raise exception 'expected create_memory_order price was not found';
  end if;
  execute replace(
    v_definition,
    'v_regular_price integer := 24800;',
    'v_regular_price integer := 19800;'
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
  if position('launch-monitor-19800-10' in v_definition) = 0
     or position('v_price := 19800;' in v_definition) = 0 then
    raise exception 'expected submit_memory_order pricing was not found';
  end if;
  v_definition := replace(
    v_definition,
    'hashtext(''wan-memory-launch-monitor-19800-10'')',
    'hashtext(''wan-memory-launch-monitor-16800-10'')'
  );
  v_definition := replace(
    v_definition,
    'where campaign_id = ''launch-monitor-19800-10''',
    'where campaign_id in (''launch-monitor-19800-10'', ''launch-monitor-16800-10'')'
  );
  v_definition := replace(
    v_definition,
    'v_price := 19800;',
    'v_price := 16800;'
  );
  v_definition := replace(
    v_definition,
    'v_campaign := ''launch-monitor-19800-10'';',
    'v_campaign := ''launch-monitor-16800-10'';'
  );
  execute v_definition;
end;
$$;

revoke all on function public.get_memory_film_pricing() from public;
grant execute on function public.get_memory_film_pricing() to anon, authenticated;
