-- Operators can maintain a delivered customer's lifetime album from the
-- customer-site management view. Customer ownership remains unchanged.

create or replace function public.register_lifetime_album_photo(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_asset_id uuid;
  v_daily_count integer;
  v_total_bytes bigint;
  v_sort_order integer;
begin
  if v_actor_id is null then raise exception 'ログインが必要です。'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'JPEG、PNG、WebPの写真を選んでください。';
  end if;
  if p_file_size <= 0 or p_file_size > 20971520 then
    raise exception '写真1枚の上限は20MBです。';
  end if;
  if char_length(trim(coalesce(p_original_filename, ''))) not between 1 and 255 then
    raise exception '写真のファイル名を確認できません。';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or (v_order.user_id <> v_actor_id and not public.is_admin())
     or v_order.status <> 'delivered'
     or not exists (select 1 from public.deliveries where order_id = p_order_id) then
    raise exception '完成後のアルバムで写真を追加できます。';
  end if;
  if p_storage_path not like v_order.user_id::text || '/' || p_order_id::text || '/album/%' then
    raise exception '写真の保存先が正しくありません。';
  end if;

  select count(*)::integer into v_daily_count
  from public.order_events
  where order_id = p_order_id
    and event_type = 'lifetime_album_photo_uploaded'
    and created_at >= now() - interval '24 hours';
  if v_daily_count >= 50 then
    raise exception '1日に追加できる写真は50枚までです。時間をおいてお試しください。';
  end if;

  select coalesce(sum(file_size), 0)::bigint into v_total_bytes
  from public.assets
  where order_id = p_order_id and category = 'album_photo';
  if v_total_bytes + p_file_size > 5368709120 then
    raise exception 'アルバムの保存容量が5GBに達しました。サポートへご相談ください。';
  end if;

  select coalesce(max(album_sort_order), -1) + 1 into v_sort_order
  from public.assets
  where order_id = p_order_id and category in ('source_image', 'album_photo');

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename,
    mime_type, file_size, album_visible, album_sort_order
  ) values (
    p_order_id, v_order.user_id, 'album_photo', p_storage_path,
    trim(p_original_filename), p_mime_type, p_file_size, true, v_sort_order
  ) returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, v_actor_id, 'lifetime_album_photo_uploaded', jsonb_build_object(
    'asset_id', v_asset_id,
    'file_size', p_file_size,
    'managed_by_admin', v_actor_id <> v_order.user_id
  ));
  return jsonb_build_object('asset_id', v_asset_id);
end;
$$;

create or replace function public.delete_lifetime_album_photo(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_asset public.assets%rowtype;
begin
  if v_actor_id is null then raise exception 'ログインが必要です。'; end if;

  select * into v_asset
  from public.assets
  where id = p_asset_id and category = 'album_photo'
  for update;

  if not found or (v_asset.user_id <> v_actor_id and not public.is_admin()) then
    raise exception '追加した写真を確認できませんでした。';
  end if;

  delete from public.assets where id = p_asset_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (v_asset.order_id, v_actor_id, 'lifetime_album_photo_deleted', jsonb_build_object(
    'asset_id', p_asset_id,
    'managed_by_admin', v_actor_id <> v_asset.user_id
  ));
end;
$$;

revoke all on function public.register_lifetime_album_photo(uuid, text, text, text, bigint) from public, anon;
revoke all on function public.delete_lifetime_album_photo(uuid) from public, anon;
grant execute on function public.register_lifetime_album_photo(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.delete_lifetime_album_photo(uuid) to authenticated;
