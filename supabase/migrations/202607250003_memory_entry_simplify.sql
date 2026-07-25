-- Memory entry simplification: the separate "その子の表情や動き"
-- (dog_behavior) field is removed from the customer form. Expressions and
-- movements are now written inside the main description field. dog_behavior
-- becomes optional/nullable (kept for legacy orders and as an optional
-- operator note). Memory photos stay optional reference material — the
-- director judges the content, produces scene stills, and shows them to the
-- customer before animation.

alter table public.order_memories alter column dog_behavior drop not null;
alter table public.order_memories drop constraint if exists order_memories_dog_behavior_check;
alter table public.order_memories add constraint order_memories_dog_behavior_check check (
  dog_behavior is null or char_length(trim(dog_behavior)) between 1 and 1000
);

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
  if p_dog_behavior is not null and char_length(trim(p_dog_behavior)) > 1000 then raise exception 'dog behavior must be 1000 characters or fewer'; end if;

  insert into public.order_memories (
    order_id, user_id, client_key, sort_order, title, when_text, location, description, dog_behavior
  ) values (
    p_order_id, auth.uid(), trim(p_client_key), p_sort_order, trim(p_title),
    nullif(trim(coalesce(p_when_text, '')), ''), nullif(trim(coalesce(p_location, '')), ''),
    trim(p_description), nullif(trim(coalesce(p_dog_behavior, '')), '')
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
