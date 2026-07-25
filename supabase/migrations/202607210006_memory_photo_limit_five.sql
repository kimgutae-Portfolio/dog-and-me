-- Allow up to five source photos for each memory.
-- This migration is intentionally safe to apply after 202607210005 on an
-- existing project, while the updated 005 file keeps fresh installs correct.

create or replace function public.enforce_asset_memory_link()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_photo_count integer;
begin
  if new.memory_id is null then return new; end if;
  if new.category <> 'source_image' then raise exception 'only source images may be linked to a memory'; end if;
  if not exists (
    select 1 from public.order_memories m
    where m.id = new.memory_id and m.order_id = new.order_id and m.user_id = new.user_id
  ) then raise exception 'memory and asset ownership do not match'; end if;

  select count(*)::integer into v_photo_count
  from public.assets
  where memory_id = new.memory_id and category = 'source_image'
    and (tg_op = 'INSERT' or id <> new.id);
  if v_photo_count >= 5 then raise exception 'a memory can contain up to 5 photos'; end if;
  return new;
end;
$$;

create or replace function public.submit_memory_order(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_memory_count integer;
  v_photo_count integer;
  v_invalid_memory_count integer;
  v_launch_count integer;
  v_price integer;
  v_campaign text;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found or v_order.status <> 'awaiting_materials' then raise exception 'order not found or cannot be submitted'; end if;
  if v_order.draft_expires_at is not null and v_order.draft_expires_at <= now() then raise exception 'draft expired'; end if;
  if coalesce(trim(v_order.age_text), '') = '' then raise exception 'age required'; end if;
  if jsonb_typeof(v_order.personality) <> 'array' or jsonb_array_length(v_order.personality) < 1 then raise exception 'personality required'; end if;
  if coalesce(trim(v_order.message_to_pet), '') = '' then raise exception 'message to pet required'; end if;
  if not public.order_has_current_consents(p_order_id) then raise exception 'current consent record required'; end if;

  select count(*)::integer into v_memory_count
  from public.order_memories
  where order_id = p_order_id and user_id = auth.uid();
  if v_memory_count not between 2 and 6 then raise exception 'between 2 and 6 memory entries are required'; end if;

  select count(*)::integer into v_invalid_memory_count
  from (
    select m.id
    from public.order_memories m
    left join public.assets a
      on a.memory_id = m.id and a.category = 'source_image'
    where m.order_id = p_order_id and m.user_id = auth.uid()
    group by m.id
    having count(a.id) not between 1 and 5
  ) invalid_memories;
  if v_invalid_memory_count > 0 then raise exception 'each memory requires 1 to 5 photos'; end if;

  select count(*)::integer into v_photo_count
  from public.assets a
  join public.order_memories m on m.id = a.memory_id
  where a.order_id = p_order_id and a.user_id = auth.uid() and a.category = 'source_image';
  if v_photo_count < 5 then raise exception 'at least 5 memory photos are required'; end if;

  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-10'));
  select count(*)::integer into v_launch_count
  from public.orders
  where campaign_id = 'launch-monitor-10' and status not in ('awaiting_materials', 'cancelled');

  if v_launch_count < 10 then
    v_price := 24800;
    v_campaign := 'launch-monitor-10';
  else
    v_price := v_order.regular_price;
    v_campaign := null;
  end if;

  update public.orders
  set status = 'materials_submitted', quoted_price = v_price, campaign_id = v_campaign,
      stage_updated_at = now(), draft_expires_at = null
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'materials_submitted',
    jsonb_build_object(
      'memory_count', v_memory_count,
      'photo_count', v_photo_count,
      'quoted_price', v_price,
      'campaign_id', v_campaign,
      'consented_at', v_order.consented_at,
      'terms_version', v_order.terms_version,
      'privacy_version', v_order.privacy_version,
      'ai_notice_version', v_order.ai_notice_version
    )
  );
end;
$$;

revoke all on function public.submit_memory_order(uuid) from public, anon;
grant execute on function public.submit_memory_order(uuid) to authenticated;
