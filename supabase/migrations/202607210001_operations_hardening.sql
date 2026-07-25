-- 운영 안전성 강화
-- 1. 프로모션 자리는 자료 제출이 완료된 주문만 점유합니다.
-- 2. 최소 사진 5장과 수정 2회 제한을 DB에서 강제합니다.
-- 3. 관리자 변경은 검증된 RPC만 사용하며 order_events에 기록합니다.
-- 4. 고객 확인용 영상과 최종 납품 영상을 분리합니다.

alter table public.orders
  add column if not exists revision_limit integer not null default 2,
  add column if not exists revision_used integer not null default 0;

update public.orders as orders
set
  revision_used = revisions.used,
  revision_limit = greatest(orders.revision_limit, revisions.used)
from (
  select order_id, count(*)::integer as used
  from public.revision_requests
  group by order_id
) as revisions
where orders.id = revisions.order_id;

alter table public.orders
  drop constraint if exists orders_revision_limit_check,
  drop constraint if exists orders_revision_used_check,
  add constraint orders_revision_limit_check check (revision_limit >= 0),
  add constraint orders_revision_used_check check (revision_used >= 0 and revision_used <= revision_limit);

alter table public.messages
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.messages
  drop constraint if exists messages_status_check,
  add constraint messages_status_check check (status in ('open', 'resolved'));

update public.messages as message
set status = 'resolved',
    resolved_at = coalesce(message.resolved_at, message.created_at),
    resolved_by = coalesce(message.resolved_by, message.sender_id)
from public.profiles as sender
where sender.id = message.sender_id
  and sender.role = 'admin';

alter table public.revision_requests
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets
  add constraint assets_category_check
  check (category in ('source_image', 'source_video', 'review_video', 'final_video', 'thumbnail'));

-- 아직 자료가 제출되지 않은 기존 주문은 프로모션 자리를 반환합니다.
update public.orders
set campaign_id = null,
    quoted_price = regular_price
where status = 'awaiting_materials'
  and campaign_id = 'launch-monitor-10';

create or replace function public.create_memory_order(p_data jsonb)
returns table(order_id uuid, order_number text, quoted_price integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_regular_price integer := 29800;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_data ->> 'pet_name'), '') = '' then raise exception 'pet name required'; end if;
  if coalesce(trim(p_data ->> 'breed'), '') = '' then raise exception 'breed required'; end if;

  v_order_number := 'WM-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));

  insert into public.orders (
    id, user_id, order_number, pet_name, name_kana, breed, age_text,
    purpose, personality, first_meeting, favorite_memory, message_to_pet,
    avoid_notes, style, aspect_ratio, narration, bgm, quoted_price,
    regular_price, campaign_id, status, revision_limit, revision_used
  ) values (
    v_order_id, v_user_id, v_order_number, trim(p_data ->> 'pet_name'),
    nullif(trim(p_data ->> 'name_kana'), ''), trim(p_data ->> 'breed'),
    nullif(trim(p_data ->> 'age_text'), ''), p_data ->> 'purpose',
    coalesce(p_data -> 'personality', '[]'::jsonb),
    nullif(trim(p_data ->> 'first_meeting'), ''),
    nullif(trim(p_data ->> 'favorite_memory'), ''),
    nullif(trim(p_data ->> 'message_to_pet'), ''),
    nullif(trim(p_data ->> 'avoid_notes'), ''),
    p_data ->> 'style', p_data ->> 'aspect_ratio', p_data ->> 'narration',
    p_data ->> 'bgm', v_regular_price, v_regular_price, null,
    'awaiting_materials', 2, 0
  );

  insert into public.order_events (order_id, actor_id, event_type, payload)
  values (v_order_id, v_user_id, 'order_draft_created', jsonb_build_object('quoted_price', v_regular_price));

  return query select v_order_id, v_order_number, v_regular_price;
end;
$$;

create or replace function public.save_memory_order_draft(p_order_id uuid, p_data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_data ->> 'pet_name'), '') = '' then raise exception 'pet name required'; end if;
  if coalesce(trim(p_data ->> 'breed'), '') = '' then raise exception 'breed required'; end if;

  update public.orders
  set pet_name = trim(p_data ->> 'pet_name'),
      name_kana = nullif(trim(p_data ->> 'name_kana'), ''),
      breed = trim(p_data ->> 'breed'),
      age_text = nullif(trim(p_data ->> 'age_text'), ''),
      purpose = p_data ->> 'purpose',
      personality = coalesce(p_data -> 'personality', '[]'::jsonb),
      first_meeting = nullif(trim(p_data ->> 'first_meeting'), ''),
      favorite_memory = nullif(trim(p_data ->> 'favorite_memory'), ''),
      message_to_pet = nullif(trim(p_data ->> 'message_to_pet'), ''),
      avoid_notes = nullif(trim(p_data ->> 'avoid_notes'), ''),
      style = p_data ->> 'style',
      aspect_ratio = p_data ->> 'aspect_ratio',
      narration = p_data ->> 'narration',
      bgm = p_data ->> 'bgm'
  where id = p_order_id
    and user_id = auth.uid()
    and status = 'awaiting_materials';

  if not found then raise exception 'draft order not found'; end if;

  insert into public.order_events(order_id, actor_id, event_type)
  values (p_order_id, auth.uid(), 'order_draft_updated');
end;
$$;

create or replace function public.get_memory_film_pricing()
returns table(
  current_price integer,
  regular_price integer,
  launch_limit integer,
  launch_used integer,
  launch_remaining integer,
  campaign_active boolean
)
language sql
stable
security definer set search_path = public
as $$
  with counts as (
    select count(*)::integer as used
    from public.orders
    where campaign_id = 'launch-monitor-10'
      and status not in ('awaiting_materials', 'cancelled')
  )
  select
    case when used < 10 then 24800 else 29800 end,
    29800,
    10,
    used,
    greatest(10 - used, 0),
    used < 10
  from counts;
$$;

create or replace function public.submit_memory_order(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_photo_count integer;
  v_launch_count integer;
  v_price integer;
  v_campaign text;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found or v_order.status <> 'awaiting_materials' then
    raise exception 'order not found or cannot be submitted';
  end if;

  select count(*)::integer into v_photo_count
  from public.assets
  where order_id = p_order_id and user_id = auth.uid() and category = 'source_image';

  if v_photo_count < 5 then
    raise exception 'at least 5 source images are required';
  end if;

  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-10'));
  select count(*)::integer into v_launch_count
  from public.orders
  where campaign_id = 'launch-monitor-10'
    and status not in ('awaiting_materials', 'cancelled');

  if v_launch_count < 10 then
    v_price := 24800;
    v_campaign := 'launch-monitor-10';
  else
    v_price := v_order.regular_price;
    v_campaign := null;
  end if;

  update public.orders
  set status = 'materials_submitted',
      quoted_price = v_price,
      campaign_id = v_campaign,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'materials_submitted',
    jsonb_build_object('photo_count', v_photo_count, 'quoted_price', v_price, 'campaign_id', v_campaign)
  );
end;
$$;

create or replace function public.request_order_revision(p_order_id uuid, p_category text, p_body text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_revision_number integer;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'revision body required'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found or v_order.status <> 'customer_review' then
    raise exception 'order not found or revision unavailable';
  end if;
  if v_order.revision_used >= v_order.revision_limit then
    raise exception 'revision limit reached';
  end if;
  if exists (select 1 from public.revision_requests where order_id = p_order_id and status = 'open') then
    raise exception 'previous revision is still open';
  end if;

  v_revision_number := v_order.revision_used + 1;

  insert into public.revision_requests(order_id, user_id, category, body)
  values (p_order_id, auth.uid(), coalesce(nullif(trim(p_category), ''), 'その他'), trim(p_body));

  update public.orders
  set status = 'revision_requested',
      revision_used = v_revision_number,
      stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    'revision_requested',
    jsonb_build_object('category', p_category, 'revision_number', v_revision_number, 'revision_limit', v_order.revision_limit)
  );
end;
$$;

create or replace function public.is_valid_order_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('awaiting_materials', 'cancelled'),
    ('materials_submitted', 'reviewing_materials'),
    ('materials_submitted', 'cancelled'),
    ('reviewing_materials', 'cancelled'),
    ('concepts_ready', 'reviewing_materials'),
    ('concepts_ready', 'cancelled'),
    ('concept_selected', 'concepts_ready'),
    ('concept_selected', 'production'),
    ('concept_selected', 'cancelled'),
    ('production', 'concept_selected'),
    ('production', 'cancelled'),
    ('customer_review', 'production'),
    ('customer_review', 'quality_check'),
    ('customer_review', 'cancelled'),
    ('revision_requested', 'production'),
    ('revision_requested', 'cancelled'),
    ('quality_check', 'production'),
    ('quality_check', 'customer_review'),
    ('quality_check', 'cancelled')
  );
$$;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_status text,
  p_payment_status text,
  p_due_date date,
  p_admin_notes text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_before from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not public.is_valid_order_transition(v_before.status, p_status) then
    raise exception 'invalid order status transition: % -> %', v_before.status, p_status;
  end if;
  if p_payment_status not in ('pending', 'invoice_sent', 'paid', 'refunded') then
    raise exception 'invalid payment status';
  end if;

  update public.orders
  set status = p_status,
      payment_status = p_payment_status,
      due_date = p_due_date,
      admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
      stage_updated_at = case when status is distinct from p_status then now() else stage_updated_at end
  where id = p_order_id;

  if v_before.status is distinct from p_status
     or v_before.payment_status is distinct from p_payment_status
     or v_before.due_date is distinct from p_due_date
     or v_before.admin_notes is distinct from nullif(trim(coalesce(p_admin_notes, '')), '') then
    insert into public.order_events(order_id, actor_id, event_type, payload)
    values (
      p_order_id,
      auth.uid(),
      'admin_order_updated',
      jsonb_build_object(
        'before', jsonb_build_object('status', v_before.status, 'payment_status', v_before.payment_status, 'due_date', v_before.due_date),
        'after', jsonb_build_object('status', p_status, 'payment_status', p_payment_status, 'due_date', p_due_date),
        'admin_notes_changed', v_before.admin_notes is distinct from nullif(trim(coalesce(p_admin_notes, '')), '')
      )
    );
  end if;
end;
$$;

create or replace function public.admin_publish_concepts(p_order_id uuid, p_concepts jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if jsonb_typeof(p_concepts) <> 'array' or jsonb_array_length(p_concepts) <> 2 then
    raise exception 'exactly two concepts are required';
  end if;
  if (select count(distinct item ->> 'slot') from jsonb_array_elements(p_concepts) as item where item ->> 'slot' in ('A', 'B')) <> 2 then
    raise exception 'concept slots A and B are required';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_concepts) as item
    where coalesce(trim(item ->> 'title'), '') = ''
       or coalesce(trim(item ->> 'summary'), '') = ''
       or jsonb_typeof(coalesce(item -> 'scenes', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'concept title, summary and scene array are required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status not in ('reviewing_materials', 'concepts_ready') then
    raise exception 'concepts cannot be published in current status';
  end if;

  insert into public.concepts(order_id, slot, title, tone, summary, scenes, status)
  select
    p_order_id,
    item ->> 'slot',
    trim(item ->> 'title'),
    trim(coalesce(item ->> 'tone', '')),
    trim(item ->> 'summary'),
    coalesce(item -> 'scenes', '[]'::jsonb),
    'published'
  from jsonb_array_elements(p_concepts) as item
  on conflict (order_id, slot) do update
  set title = excluded.title,
      tone = excluded.tone,
      summary = excluded.summary,
      scenes = excluded.scenes,
      status = 'published';

  update public.orders
  set status = 'concepts_ready', stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'concepts_published', p_concepts);
end;
$$;

create or replace function public.admin_register_video_asset(
  p_order_id uuid,
  p_category text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_asset_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_category not in ('review_video', 'final_video') then raise exception 'invalid video category'; end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm') then raise exception 'invalid video mime type'; end if;
  if p_file_size <= 0 or p_file_size > 209715200 then raise exception 'invalid video file size'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if p_storage_path not like v_order.user_id::text || '/' || v_order.id::text || '/%' then
    raise exception 'invalid storage path';
  end if;

  if p_category = 'review_video' and v_order.status not in ('production', 'revision_requested', 'customer_review') then
    raise exception 'review video cannot be uploaded in current status';
  end if;
  if p_category = 'final_video' and v_order.status <> 'quality_check' then
    raise exception 'final video requires quality_check status';
  end if;

  insert into public.assets(order_id, user_id, category, storage_path, original_filename, mime_type, file_size)
  values (p_order_id, v_order.user_id, p_category, p_storage_path, p_original_filename, p_mime_type, p_file_size)
  returning id into v_asset_id;

  if p_category = 'review_video' then
    update public.orders
    set status = 'customer_review', stage_updated_at = now()
    where id = p_order_id;
  end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id,
    auth.uid(),
    case when p_category = 'review_video' then 'review_video_uploaded' else 'final_video_uploaded' end,
    jsonb_build_object('asset_id', v_asset_id, 'filename', p_original_filename, 'file_size', p_file_size)
  );

  return v_asset_id;
end;
$$;

create or replace function public.admin_deliver_order(
  p_order_id uuid,
  p_asset_id uuid,
  p_title text,
  p_customer_message text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'delivery title required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'quality_check' then raise exception 'delivery requires quality_check status'; end if;
  if not exists (
    select 1 from public.assets
    where id = p_asset_id and order_id = p_order_id and category = 'final_video'
  ) then raise exception 'final video asset not found'; end if;

  insert into public.deliveries(order_id, final_asset_id, title, customer_message, delivered_at)
  values (p_order_id, p_asset_id, trim(p_title), nullif(trim(coalesce(p_customer_message, '')), ''), now())
  on conflict (order_id) do update
  set final_asset_id = excluded.final_asset_id,
      title = excluded.title,
      customer_message = excluded.customer_message,
      delivered_at = now();

  update public.orders
  set status = 'delivered', stage_updated_at = now()
  where id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_delivered', jsonb_build_object('asset_id', p_asset_id, 'title', trim(p_title)));
end;
$$;

create or replace function public.admin_resolve_revision(p_revision_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order_id uuid;
  v_requested_at timestamptz;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select order_id, created_at into v_order_id, v_requested_at
  from public.revision_requests
  where id = p_revision_id and status = 'open'
  for update;
  if not found then raise exception 'open revision not found'; end if;

  if not exists (
    select 1 from public.assets
    where order_id = v_order_id
      and category = 'review_video'
      and created_at > v_requested_at
  ) then
    raise exception 'upload a revised review video before resolving the revision';
  end if;

  update public.revision_requests
  set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_revision_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (v_order_id, auth.uid(), 'revision_resolved', jsonb_build_object('revision_id', p_revision_id));
end;
$$;

create or replace function public.admin_resolve_message(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  update public.messages
  set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_message_id and status = 'open'
  returning order_id into v_order_id;
  if v_order_id is null then raise exception 'open message not found'; end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (v_order_id, auth.uid(), 'message_resolved', jsonb_build_object('message_id', p_message_id));
end;
$$;

create or replace function public.admin_send_message(p_order_id uuid, p_body text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_message_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if coalesce(trim(p_body), '') = '' or char_length(trim(p_body)) > 3000 then
    raise exception 'message body must contain 1 to 3000 characters';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id) then raise exception 'order not found'; end if;

  insert into public.messages(order_id, sender_id, body, status, resolved_at, resolved_by)
  values (p_order_id, auth.uid(), trim(p_body), 'resolved', now(), auth.uid())
  returning id into v_message_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'admin_message_sent', jsonb_build_object('message_id', v_message_id));
end;
$$;

revoke all on function public.is_valid_order_transition(text, text) from public;
revoke all on function public.save_memory_order_draft(uuid, jsonb) from public;
revoke all on function public.admin_update_order(uuid, text, text, date, text) from public;
revoke all on function public.admin_publish_concepts(uuid, jsonb) from public;
revoke all on function public.admin_register_video_asset(uuid, text, text, text, text, bigint) from public;
revoke all on function public.admin_deliver_order(uuid, uuid, text, text) from public;
revoke all on function public.admin_resolve_revision(uuid) from public;
revoke all on function public.admin_resolve_message(uuid) from public;
revoke all on function public.admin_send_message(uuid, text) from public;

grant execute on function public.admin_update_order(uuid, text, text, date, text) to authenticated;
grant execute on function public.save_memory_order_draft(uuid, jsonb) to authenticated;
grant execute on function public.admin_publish_concepts(uuid, jsonb) to authenticated;
grant execute on function public.admin_register_video_asset(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.admin_deliver_order(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_resolve_revision(uuid) to authenticated;
grant execute on function public.admin_resolve_message(uuid) to authenticated;
grant execute on function public.admin_send_message(uuid, text) to authenticated;
