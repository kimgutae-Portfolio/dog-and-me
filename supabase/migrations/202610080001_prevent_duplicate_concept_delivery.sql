-- A published story direction must not be sent twice accidentally. To revise
-- and resend it, an administrator must explicitly return the order to the
-- reviewing_materials stage first.
create or replace function public.admin_publish_concepts(p_order_id uuid, p_concepts jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_story_scenes jsonb;
  v_scenes jsonb;
  v_memory_count integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if jsonb_typeof(p_concepts) <> 'array' or jsonb_array_length(p_concepts) <> 2 then raise exception 'exactly two concepts are required'; end if;
  if (select count(distinct item ->> 'slot') from jsonb_array_elements(p_concepts) item where item ->> 'slot' in ('A', 'B')) <> 2 then raise exception 'concept slots A and B are required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then
    raise exception '写真の運営承認が必要です。';
  end if;
  if v_order.status <> 'reviewing_materials' then
    raise exception 'concepts cannot be published in current status';
  end if;

  select count(*) into v_memory_count from public.order_memories where order_id = p_order_id;
  if v_memory_count <> 5 then raise exception 'exactly five stories are required'; end if;

  for v_item in select value from jsonb_array_elements(p_concepts)
  loop
    if coalesce(trim(v_item ->> 'title'), '') = ''
       or coalesce(trim(v_item ->> 'summary'), '') = ''
       or jsonb_typeof(coalesce(v_item -> 'story_scenes', 'null'::jsonb)) <> 'array' then
      raise exception 'concept title, summary and five story scenes are required';
    end if;
    if jsonb_array_length(v_item -> 'story_scenes') <> 5 then
      raise exception 'concept title, summary and five story scenes are required';
    end if;
    if (select count(distinct scene ->> 'memory_id') from jsonb_array_elements(v_item -> 'story_scenes') scene) <> 5 then
      raise exception 'each story must appear exactly once in every concept';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_item -> 'story_scenes') scene
      left join public.order_memories memory
        on memory.id::text = scene ->> 'memory_id' and memory.order_id = p_order_id
      where memory.id is null or coalesce(trim(scene ->> 'text'), '') = ''
    ) then raise exception 'every concept scene must match a submitted story and contain text'; end if;

    select
      jsonb_agg(jsonb_build_object(
        'memory_id', memory.id,
        'memory_number', memory.sort_order,
        'memory_title', memory.title,
        'text', trim(scene ->> 'text')
      ) order by memory.sort_order),
      jsonb_agg(trim(scene ->> 'text') order by memory.sort_order)
    into v_story_scenes, v_scenes
    from public.order_memories memory
    join jsonb_array_elements(v_item -> 'story_scenes') scene
      on memory.id::text = scene ->> 'memory_id'
    where memory.order_id = p_order_id;

    insert into public.concepts(order_id, slot, title, tone, summary, scenes, story_scenes, status)
    values (
      p_order_id,
      v_item ->> 'slot',
      trim(v_item ->> 'title'),
      trim(coalesce(v_item ->> 'tone', '')),
      trim(v_item ->> 'summary'),
      v_scenes,
      v_story_scenes,
      'published'
    )
    on conflict (order_id, slot) do update
    set title = excluded.title,
        tone = excluded.tone,
        summary = excluded.summary,
        scenes = excluded.scenes,
        story_scenes = excluded.story_scenes,
        status = 'published';
  end loop;

  update public.orders set status = 'concepts_ready', stage_updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'concepts_published', p_concepts);
end;
$$;

revoke all on function public.admin_publish_concepts(uuid, jsonb) from public, anon;
grant execute on function public.admin_publish_concepts(uuid, jsonb) to authenticated;
