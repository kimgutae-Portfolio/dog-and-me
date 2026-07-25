-- Store each customer memory together with the photos that describe it.
-- This makes the customer form and the manual Runway production workflow share
-- the same scene-level source of truth.

create table if not exists public.order_memories (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_key text not null check (char_length(client_key) between 1 and 100),
  sort_order smallint not null check (sort_order between 1 and 6),
  title text not null check (char_length(trim(title)) between 1 and 80),
  when_text text check (when_text is null or char_length(trim(when_text)) between 1 and 120),
  location text check (location is null or char_length(trim(location)) between 1 and 120),
  description text not null check (char_length(trim(description)) between 30 and 2000),
  dog_behavior text not null check (char_length(trim(dog_behavior)) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, client_key),
  unique(order_id, sort_order)
);

create index if not exists order_memories_order_idx
  on public.order_memories(order_id, sort_order);

alter table public.assets
  add column if not exists memory_id uuid references public.order_memories(id) on delete set null;

create index if not exists assets_memory_idx
  on public.assets(memory_id, created_at);

drop trigger if exists order_memories_set_updated_at on public.order_memories;
create trigger order_memories_set_updated_at before update on public.order_memories
for each row execute function public.set_updated_at();

alter table public.order_memories enable row level security;

drop policy if exists order_memories_select on public.order_memories;
create policy order_memories_select on public.order_memories for select to authenticated
using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.order_memories from authenticated;
grant select on public.order_memories to authenticated;

create or replace function public.save_order_memory_entry(
  p_order_id uuid,
  p_client_key text,
  p_sort_order integer,
  p_title text,
  p_when_text text,
  p_location text,
  p_description text,
  p_dog_behavior text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_memory_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then raise exception 'draft order not found'; end if;
  if p_sort_order not between 1 and 6 then raise exception 'memory order must be between 1 and 6'; end if;
  if char_length(trim(coalesce(p_client_key, ''))) not between 1 and 100 then raise exception 'memory client key required'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80 then raise exception 'memory title required'; end if;
  if char_length(trim(coalesce(p_description, ''))) not between 30 and 2000 then raise exception 'memory description must contain at least 30 characters'; end if;
  if char_length(trim(coalesce(p_dog_behavior, ''))) not between 10 and 1000 then raise exception 'dog behavior must contain at least 10 characters'; end if;

  insert into public.order_memories (
    order_id, user_id, client_key, sort_order, title, when_text, location, description, dog_behavior
  ) values (
    p_order_id, auth.uid(), trim(p_client_key), p_sort_order, trim(p_title),
    nullif(trim(coalesce(p_when_text, '')), ''), nullif(trim(coalesce(p_location, '')), ''),
    trim(p_description), trim(p_dog_behavior)
  )
  on conflict (order_id, client_key) do update
  set sort_order = excluded.sort_order,
      title = excluded.title,
      when_text = excluded.when_text,
      location = excluded.location,
      description = excluded.description,
      dog_behavior = excluded.dog_behavior,
      updated_at = now()
  returning id into v_memory_id;

  return v_memory_id;
end;
$$;

revoke all on function public.save_order_memory_entry(uuid, text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.save_order_memory_entry(uuid, text, integer, text, text, text, text, text) to authenticated;

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

drop trigger if exists enforce_asset_memory_link_trigger on public.assets;
create trigger enforce_asset_memory_link_trigger
before insert or update of memory_id on public.assets
for each row execute function public.enforce_asset_memory_link();

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

create or replace function public.expire_memory_order_draft(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.orders
  set status = 'cancelled', stage_updated_at = now(), campaign_id = null,
      personality = '[]'::jsonb,
      first_meeting = null,
      favorite_memory = null,
      message_to_pet = null,
      avoid_notes = null,
      admin_notes = null,
      selected_concept_slot = null
  where id = p_order_id
    and status = 'awaiting_materials'
    and draft_expires_at is not null
    and draft_expires_at <= now();
  if not found then raise exception 'expired draft not found'; end if;

  delete from public.order_memories where order_id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, null, 'draft_expired', jsonb_build_object('expired_at', now()));
end;
$$;

revoke all on function public.expire_memory_order_draft(uuid) from public, anon, authenticated;
grant execute on function public.expire_memory_order_draft(uuid) to service_role;
