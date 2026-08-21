-- Lets a customer or admin attach a single photo to a chat message.
--
-- Storage path convention matches other customer-visible uploads (final_video,
-- scene_still): `${order.user_id}/${order.id}/messages/...`, never the
-- uploader's own uid. The existing order-assets RLS already grants the order
-- owner read access to their own uid folder and admins access to everything,
-- so an admin-sent photo (uploaded under the customer's uid) is still
-- readable by both sides with no policy change.

alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size bigint;

-- The original inline check required a non-empty body; a photo-only message
-- has none, so replace it with a pair of checks: body length capped whether
-- present or not, and at least one of body/attachment required so an
-- empty-empty message can't be inserted.
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_length_check check (char_length(body) <= 3000),
  add constraint messages_body_or_attachment_check check (
    char_length(trim(body)) > 0 or attachment_path is not null
  ),
  add constraint messages_attachment_fields_check check (
    (attachment_path is null) = (attachment_mime_type is null)
  );

-- CREATE OR REPLACE cannot add parameters to an existing signature — it would
-- coexist as a second overload instead of replacing it, and a 2-arg call
-- would keep resolving to the old exact-match version. Drop it explicitly so
-- exactly one admin_send_message exists.
drop function if exists public.admin_send_message(uuid, text);

create or replace function public.admin_send_message(
  p_order_id uuid,
  p_body text,
  p_attachment_path text default null,
  p_attachment_mime_type text default null,
  p_attachment_size bigint default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_message_id uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if char_length(v_body) = 0 and p_attachment_path is null then
    raise exception 'message must contain body text or an attachment';
  end if;
  if char_length(v_body) > 3000 then
    raise exception 'message body must be 3000 characters or fewer';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id) then raise exception 'order not found'; end if;

  insert into public.messages(
    order_id, sender_id, body, status, resolved_at, resolved_by,
    attachment_path, attachment_mime_type, attachment_size
  )
  values (
    p_order_id, auth.uid(), v_body, 'resolved', now(), auth.uid(),
    p_attachment_path, p_attachment_mime_type, p_attachment_size
  )
  returning id into v_message_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'admin_message_sent', jsonb_build_object(
    'message_id', v_message_id,
    'has_attachment', p_attachment_path is not null
  ));
end;
$$;

-- Extend the file-purge/delete paths from 202608110001_admin_order_cancellation.sql
-- so a chat photo is cleaned up the same way order photos and videos are: purge
-- clears the file but keeps the message text, delete removes the row entirely.

create or replace function public.admin_purge_order_files(p_order_id uuid)
returns setof text
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_paths text[];
  v_message_paths text[];
begin
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'cancelled' then
    raise exception 'cancel the order before deleting its files';
  end if;

  select coalesce(array_agg(storage_path), '{}'::text[])
    into v_paths
    from public.assets
   where order_id = p_order_id;

  select coalesce(array_agg(attachment_path), '{}'::text[])
    into v_message_paths
    from public.messages
   where order_id = p_order_id and attachment_path is not null;

  -- A photo-only message has an empty body, and messages_body_or_attachment_check
  -- requires at least one of the two — clearing the attachment on such a row
  -- without also filling in the body would violate that constraint.
  update public.messages
  set body = case when char_length(trim(body)) = 0 then '（写真は削除されました）' else body end,
      attachment_path = null, attachment_mime_type = null, attachment_size = null
  where order_id = p_order_id and attachment_path is not null;

  delete from public.deliveries where order_id = p_order_id;

  update public.assets
  set source_still_asset_id = null
  where order_id = p_order_id and source_still_asset_id is not null;

  update public.orders
  set stills_approved_asset_ids = null,
      stills_approved_at = null,
      stills_approved_by = null,
      stills_approved_version = null
  where id = p_order_id;

  delete from public.assets where order_id = p_order_id;

  v_paths := array_cat(v_paths, v_message_paths);

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_files_purged', jsonb_build_object(
    'deleted_file_count', coalesce(array_length(v_paths, 1), 0)
  ));

  return query select unnest(v_paths);
end;
$$;

create or replace function public.admin_delete_order(p_order_id uuid, p_reason text)
returns setof text
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_paths text[];
  v_message_paths text[];
  v_email text;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if v_reason is null then raise exception 'deletion reason required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status <> 'cancelled' then
    raise exception 'cancel the order before deleting it';
  end if;
  if v_order.payment_status <> 'pending' then
    raise exception 'orders with payment history cannot be deleted';
  end if;

  select email into v_email from public.profiles where id = v_order.user_id;

  select coalesce(array_agg(storage_path), '{}'::text[])
    into v_paths
    from public.assets
   where order_id = p_order_id;

  select coalesce(array_agg(attachment_path), '{}'::text[])
    into v_message_paths
    from public.messages
   where order_id = p_order_id and attachment_path is not null;

  v_paths := array_cat(v_paths, v_message_paths);

  insert into public.deleted_order_log(
    order_id, order_number, customer_email, pet_name, quoted_price,
    payment_status, reason, deleted_file_count, deleted_by
  ) values (
    p_order_id, v_order.order_number, v_email, v_order.pet_name, v_order.quoted_price,
    v_order.payment_status, v_reason, coalesce(array_length(v_paths, 1), 0), auth.uid()
  );

  delete from public.deliveries where order_id = p_order_id;

  update public.assets
  set source_still_asset_id = null
  where order_id = p_order_id and source_still_asset_id is not null;

  delete from public.assets where order_id = p_order_id;
  delete from public.orders where id = p_order_id;

  return query select unnest(v_paths);
end;
$$;

revoke all on function public.admin_send_message(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.admin_send_message(uuid, text, text, text, bigint) to authenticated;
