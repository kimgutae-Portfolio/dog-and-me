-- Moving-storybook scene sentences.
--
-- A scene title identifies the page inside the production workflow. The
-- story_caption is the customer-facing sentence approved with that page and
-- burned into the assembled film by the local renderer.

alter table public.assets
  add column if not exists story_caption text;

alter table public.assets
  drop constraint if exists assets_story_caption_check,
  add constraint assets_story_caption_check check (
    story_caption is null or char_length(trim(story_caption)) between 1 and 120
  );

create or replace function public.admin_update_scene_caption(
  p_asset_id uuid,
  p_story_caption text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_asset public.assets%rowtype;
  v_order_status text;
  v_caption text := nullif(trim(coalesce(p_story_caption, '')), '');
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if v_caption is null or char_length(v_caption) > 120 then
    raise exception 'story caption required (1-120 chars)';
  end if;

  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found or v_asset.category <> 'scene_still' then
    raise exception 'scene still not found';
  end if;

  select status into v_order_status from public.orders where id = v_asset.order_id for update;
  if v_order_status <> 'concept_selected' then
    raise exception 'scene caption can only be edited before publication';
  end if;

  update public.assets set story_caption = v_caption where id = p_asset_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    v_asset.order_id,
    auth.uid(),
    'scene_caption_updated',
    jsonb_build_object('asset_id', p_asset_id, 'story_caption', v_caption)
  );
end;
$$;

create or replace function public.admin_publish_scene_stills(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_still_count integer;
  v_caption_count integer;
  v_next_version integer;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'concept_selected' then raise exception 'scene stills can only be published from concept_selected'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before scene stills'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required before scene stills'; end if;
  if coalesce(v_order.photo_analysis_status, 'needs_customer_input') <> 'approved' then raise exception 'photo analysis approval required before scene stills'; end if;

  select count(*)::integer,
         count(*) filter (where nullif(trim(story_caption), '') is not null)::integer
    into v_still_count, v_caption_count
  from public.assets
  where order_id = p_order_id and category = 'scene_still';
  if v_still_count = 0 then raise exception 'at least one scene still is required before publishing'; end if;
  if v_caption_count <> v_still_count then raise exception 'every scene still requires a story caption'; end if;

  v_next_version := v_order.stills_review_version + 1;
  update public.orders
  set status = 'stills_review',
      stills_change_open = false,
      stills_review_version = v_next_version,
      stills_approved_at = null,
      stills_approved_by = null,
      stills_approved_version = null,
      stills_approved_asset_ids = null,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'scene_stills_published', jsonb_build_object('still_count', v_still_count, 'stills_review_version', v_next_version, 'captions_included', true));
end;
$$;

revoke all on function public.admin_update_scene_caption(uuid, text) from public, anon;
grant execute on function public.admin_update_scene_caption(uuid, text) to authenticated;

-- The move from cinematic reconstruction to an illustrated storybook materially
-- changes both the service terms and the external-AI notice. Reuse the already
-- hardened consent functions while advancing the version they require and store.
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
      and p.proname = any(array[
        'order_has_current_consents',
        'create_memory_order',
        'save_memory_order_draft',
        'accept_order_consents'
      ])
  loop
    v_definition := pg_get_functiondef(v_function_oid);
    if position('2026-07-29-style-v2' in v_definition) = 0 then
      raise exception 'expected consent version missing from function %', v_function_oid::regprocedure;
    end if;
    execute replace(
      v_definition,
      '2026-07-29-style-v2',
      '2026-08-02-storybook-v1'
    );
  end loop;
end;
$$;
