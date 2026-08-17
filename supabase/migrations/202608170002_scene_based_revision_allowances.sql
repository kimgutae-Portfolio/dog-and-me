-- Revision allowances are counted by selected story scene, not by submission.
-- Storybook-page and final-video allowances remain separate pools of 3 scenes.

alter table public.orders
  alter column revision_limit set default 3,
  alter column stills_revision_limit set default 3;

update public.orders
set revision_limit = greatest(3, revision_used),
    stills_revision_limit = greatest(3, stills_revision_used);

alter table public.revision_requests
  add column if not exists memory_ids uuid[] not null default '{}'::uuid[],
  add column if not exists scene_count smallint not null default 1;

alter table public.revision_requests
  drop constraint if exists revision_requests_scene_count_check,
  add constraint revision_requests_scene_count_check
    check (scene_count between 1 and 3);

revoke insert, update, delete on public.revision_requests from authenticated;
grant select on public.revision_requests to authenticated;

create or replace function public.set_default_scene_revision_limits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.revision_limit := 3;
  new.stills_revision_limit := 3;
  return new;
end;
$$;

drop trigger if exists orders_default_scene_revision_limits on public.orders;
create trigger orders_default_scene_revision_limits
before insert on public.orders
for each row execute function public.set_default_scene_revision_limits();

drop function if exists public.request_order_revision(uuid, text, text);

create function public.request_order_revision(
  p_order_id uuid,
  p_category text,
  p_body text,
  p_memory_ids uuid[]
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_scene_count integer;
  v_matching_count integer;
  v_new_used integer;
  v_memory_titles text[];
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'revision body required'; end if;
  v_scene_count := cardinality(coalesce(p_memory_ids, '{}'::uuid[]));
  if v_scene_count not between 1 and 3 then raise exception 'revision scenes required'; end if;
  if v_scene_count <> (
    select count(distinct selected.memory_id)
    from unnest(p_memory_ids) as selected(memory_id)
  ) then
    raise exception 'revision scenes must be unique';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;
  if not found or v_order.status <> 'customer_review' then
    raise exception 'order not found or revision unavailable';
  end if;

  select count(*)::integer, array_agg(title order by sort_order)
  into v_matching_count, v_memory_titles
  from public.order_memories
  where order_id = p_order_id and id = any(p_memory_ids);
  if v_matching_count <> v_scene_count then raise exception 'revision scenes invalid'; end if;
  if v_order.revision_used + v_scene_count > v_order.revision_limit then
    raise exception 'revision scene limit reached';
  end if;
  if exists (
    select 1 from public.revision_requests
    where order_id = p_order_id and status = 'open'
  ) then raise exception 'previous revision is still open';
  end if;

  v_new_used := v_order.revision_used + v_scene_count;
  insert into public.revision_requests(
    order_id, user_id, category, body, memory_ids, scene_count
  ) values (
    p_order_id, auth.uid(), coalesce(nullif(trim(p_category), ''), 'その他'),
    trim(p_body), p_memory_ids, v_scene_count
  );

  update public.orders
  set status = 'revision_requested', revision_used = v_new_used,
      customer_approved_at = null, customer_approved_by = null,
      customer_approved_review_asset_id = null, stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'revision_requested',
    jsonb_build_object(
      'category', p_category,
      'memory_ids', p_memory_ids,
      'memory_titles', v_memory_titles,
      'scene_count', v_scene_count,
      'revision_used', v_new_used,
      'revision_limit', v_order.revision_limit
    )
  );
end;
$$;

revoke all on function public.request_order_revision(uuid, text, text, uuid[]) from public;
grant execute on function public.request_order_revision(uuid, text, text, uuid[]) to authenticated;

drop function if exists public.request_stills_change(uuid, text);

create function public.request_stills_change(
  p_order_id uuid,
  p_body text,
  p_memory_ids uuid[]
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_scene_count integer;
  v_matching_count integer;
  v_new_used integer;
  v_memory_titles text[];
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 3000 then
    raise exception 'stills change body required';
  end if;
  v_scene_count := cardinality(coalesce(p_memory_ids, '{}'::uuid[]));
  if v_scene_count not between 1 and 3 then raise exception 'stills revision scenes required'; end if;
  if v_scene_count <> (
    select count(distinct selected.memory_id)
    from unnest(p_memory_ids) as selected(memory_id)
  ) then
    raise exception 'stills revision scenes must be unique';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;
  if not found or v_order.status <> 'stills_review' then
    raise exception 'order not found or stills change unavailable';
  end if;
  if v_order.stills_change_open then
    raise exception 'previous stills change request is still open';
  end if;

  select count(*)::integer, array_agg(title order by sort_order)
  into v_matching_count, v_memory_titles
  from public.order_memories
  where order_id = p_order_id and id = any(p_memory_ids);
  if v_matching_count <> v_scene_count then raise exception 'stills revision scenes invalid'; end if;
  if v_order.stills_revision_used + v_scene_count > v_order.stills_revision_limit then
    raise exception 'stills revision scene limit reached';
  end if;

  v_new_used := v_order.stills_revision_used + v_scene_count;
  insert into public.messages(order_id, sender_id, body)
  values (
    p_order_id,
    auth.uid(),
    '【絵本ページの調整 · ' || v_scene_count || '場面（使用済み' ||
      v_new_used || '/' || v_order.stills_revision_limit || '場面）】' || E'\n' ||
      '対象：' || array_to_string(v_memory_titles, ' / ') || E'\n' || trim(p_body)
  );

  update public.orders
  set stills_revision_used = v_new_used, stills_change_open = true
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'stills_change_requested',
    jsonb_build_object(
      'memory_ids', p_memory_ids,
      'memory_titles', v_memory_titles,
      'scene_count', v_scene_count,
      'stills_revision_used', v_new_used,
      'stills_revision_limit', v_order.stills_revision_limit,
      'stills_review_version', v_order.stills_review_version
    )
  );
end;
$$;

revoke all on function public.request_stills_change(uuid, text, uuid[]) from public, anon;
grant execute on function public.request_stills_change(uuid, text, uuid[]) to authenticated;

-- The included-revision scope is a material contract change. Advance the
-- bundled terms/AI-consent version everywhere the canonical consent gate is
-- defined so existing active customers are asked to acknowledge it once.
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
    if position('2026-08-02-storybook-v1' in v_definition) = 0 then
      raise exception 'expected consent version missing from function %',
        v_function_oid::regprocedure;
    end if;
    execute replace(
      v_definition,
      '2026-08-02-storybook-v1',
      '2026-08-17-scene-revision-v1'
    );
  end loop;
end;
$$;
