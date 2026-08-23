-- Included revisions are split by production stage to control video-generation
-- costs: two storybook scenes and one finished-video scene.

alter table public.orders
  alter column revision_limit set default 1,
  alter column stills_revision_limit set default 2;

-- Preserve database validity for orders that already consumed more than the
-- new allowance. Those orders finish with no remaining included revisions.
update public.orders
set revision_limit = greatest(1, revision_used),
    stills_revision_limit = greatest(2, stills_revision_used);

create or replace function public.set_default_scene_revision_limits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.revision_limit := 1;
  new.stills_revision_limit := 2;
  return new;
end;
$$;

-- The included-revision scope is part of the service contract. Advance the
-- consent version everywhere the canonical consent gate is defined.
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
    if position('2026-08-17-five-second-stories-v1' in v_definition) = 0 then
      raise exception 'expected consent version missing from function %',
        v_function_oid::regprocedure;
    end if;
    execute replace(
      v_definition,
      '2026-08-17-five-second-stories-v1',
      '2026-08-23-revision-2-1-v1'
    );
  end loop;
end;
$$;
