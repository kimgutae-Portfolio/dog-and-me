-- Extend the ¥16,800 launch monitor offer from ten to twenty completed
-- consultations. Orders already assigned to either previous ten-slot campaign
-- remain counted, so the extension does not reset the number already used.

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
      'launch-monitor-16800-20'
    )
      and status not in ('awaiting_materials', 'cancelled')
  )
  select
    case when used < 20 then 16800 else 19800 end,
    19800,
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
    and p.proname = 'submit_memory_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_order_id uuid';

  if v_function_oid is null then
    raise exception 'submit_memory_order(uuid) was not found';
  end if;

  v_definition := pg_get_functiondef(v_function_oid);
  if position('hashtext(''wan-memory-launch-monitor-16800-10'')' in v_definition) = 0
     or position('if v_launch_count < 10 then' in v_definition) = 0
     or position('v_campaign := ''launch-monitor-16800-10'';' in v_definition) = 0 then
    raise exception 'expected ten-slot launch monitor pricing was not found';
  end if;

  v_definition := replace(
    v_definition,
    'hashtext(''wan-memory-launch-monitor-16800-10'')',
    'hashtext(''wan-memory-launch-monitor-16800-20'')'
  );
  v_definition := replace(
    v_definition,
    'where campaign_id in (''launch-monitor-19800-10'', ''launch-monitor-16800-10'')',
    'where campaign_id in (''launch-monitor-19800-10'', ''launch-monitor-16800-10'', ''launch-monitor-16800-20'')'
  );
  v_definition := replace(
    v_definition,
    'if v_launch_count < 10 then',
    'if v_launch_count < 20 then'
  );
  v_definition := replace(
    v_definition,
    'v_campaign := ''launch-monitor-16800-10'';',
    'v_campaign := ''launch-monitor-16800-20'';'
  );
  execute v_definition;
end;
$$;

revoke all on function public.get_memory_film_pricing() from public;
grant execute on function public.get_memory_film_pricing() to anon, authenticated;
