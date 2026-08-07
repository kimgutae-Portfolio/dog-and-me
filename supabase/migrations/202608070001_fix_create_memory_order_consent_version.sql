-- 202608050002 (launch pricing) recreated create_memory_order from a stale
-- snapshot taken before 202608020001's consent-version bump, so it silently
-- reverted the required terms_version/ai_notice_version back to
-- '2026-07-29-style-v2'. The client (app/lib/consent.ts) has sent
-- '2026-08-02-storybook-v1' since the storybook pivot, so every order
-- creation has been failing with "current policy versions required".
-- Reapply the same dynamic patch 202608020001 used, scoped to just this
-- function, so the fix + intent stay together in one place.
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
      and p.proname = 'create_memory_order'
  loop
    v_definition := pg_get_functiondef(v_function_oid);
    if position('2026-07-29-style-v2' in v_definition) = 0 then
      raise exception 'expected stale consent version missing from function %', v_function_oid::regprocedure;
    end if;
    execute replace(
      v_definition,
      '2026-07-29-style-v2',
      '2026-08-02-storybook-v1'
    );
  end loop;
end;
$$;
