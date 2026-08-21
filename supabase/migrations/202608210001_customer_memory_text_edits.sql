-- Customers who can still change their source photos may also correct the
-- story copy that belongs to those photos. A post-submission edit invalidates
-- STORY SOURCE REVIEW so production never continues with stale wording.

create or replace function public.update_order_memory_entry(
  p_order_id uuid,
  p_memory_id uuid,
  p_title text,
  p_when_text text,
  p_location text,
  p_description text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_memory public.order_memories%rowtype;
  v_title text := trim(coalesce(p_title, ''));
  v_when_text text := nullif(trim(coalesce(p_when_text, '')), '');
  v_location text := nullif(trim(coalesce(p_location, '')), '');
  v_description text := trim(coalesce(p_description, ''));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'order not found'; end if;

  if not coalesce(v_order.source_photo_change_open, false)
     and (
       v_order.status not in ('awaiting_materials', 'materials_submitted', 'reviewing_materials')
       or (
         v_order.status <> 'awaiting_materials'
         and coalesce(v_order.photo_analysis_status, 'needs_customer_input') = 'approved'
       )
     ) then
    raise exception '現在の制作工程では物語を変更できません。';
  end if;

  if char_length(v_title) not between 1 and 80 then
    raise exception '物語のタイトルを入力してください。';
  end if;
  if v_when_text is not null and char_length(v_when_text) > 120 then
    raise exception '時期は120文字以内で入力してください。';
  end if;
  if v_location is not null and char_length(v_location) > 120 then
    raise exception '場所は120文字以内で入力してください。';
  end if;
  if char_length(v_description) not between 1 and 2000 then
    raise exception '思い出の内容を入力してください。';
  end if;

  select * into v_memory
  from public.order_memories
  where id = p_memory_id and order_id = p_order_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'story not found'; end if;

  update public.order_memories
  set title = v_title,
      when_text = v_when_text,
      location = v_location,
      description = v_description,
      updated_at = now()
  where id = p_memory_id;

  -- Keep automatically-derived album copy in sync, while preserving captions
  -- the customer has already customized in the album manager.
  update public.assets
  set album_caption = left(v_description, 120)
  where order_id = p_order_id
    and memory_id = p_memory_id
    and category = 'source_image'
    and (
      nullif(trim(coalesce(album_caption, '')), '') is null
      or album_caption = left(v_memory.description, 120)
    );

  if v_order.status <> 'awaiting_materials' then
    update public.orders
    set photo_analysis_status = 'pending_operator_review',
        photo_analysis_approved_at = null,
        photo_analysis_approved_by = null
    where id = p_order_id;

    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (p_order_id, auth.uid(), 'story_copy_changed', jsonb_build_object(
      'memory_id', p_memory_id,
      'before_title', v_memory.title,
      'after_title', v_title,
      'administrator_permission', coalesce(v_order.source_photo_change_open, false),
      'photo_analysis_status', 'pending_operator_review'
    ));
  end if;
end;
$$;

revoke all on function public.update_order_memory_entry(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.update_order_memory_entry(uuid, uuid, text, text, text, text) to authenticated;
