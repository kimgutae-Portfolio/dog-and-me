-- Every story now uses one continuous 5-second motion clip. The former
-- three-story expansion selection is retired and must not gate production.

update public.orders
set expanded_story_sort_orders = '{}'::integer[]
where cardinality(expanded_story_sort_orders) > 0;

alter table public.orders
  drop constraint if exists orders_expanded_story_sort_orders_check,
  add constraint orders_expanded_story_sort_orders_check
    check (cardinality(expanded_story_sort_orders) = 0);

drop function if exists public.admin_set_expanded_story_slots(uuid, integer[]);

-- The promised finished-film duration changed from about one minute to about
-- forty seconds, so active customers must acknowledge the updated terms.
do $$
declare
  v_function_oid oid;
  v_definition text;
begin
  for v_function_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'order_has_current_consents',
        'create_memory_order',
        'save_memory_order_draft',
        'accept_order_consents'
      )
  loop
    v_definition := pg_get_functiondef(v_function_oid);
    if position('2026-08-17-scene-revision-v1' in v_definition) = 0 then
      raise exception 'expected consent version missing from function %',
        v_function_oid::regprocedure;
    end if;
    execute replace(
      v_definition,
      '2026-08-17-scene-revision-v1',
      '2026-08-17-five-second-stories-v1'
    );
  end loop;
end;
$$;
