-- A delivered storybook site keeps growing as a lifetime photo album.
-- Production sources remain locked; customer additions use album_photo.

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check check (category in (
  'source_image', 'source_video', 'scene_still', 'render_clip',
  'transition_clip', 'assembled_film', 'review_video', 'final_video',
  'thumbnail', 'character_sprite', 'album_photo'
));

create index if not exists assets_lifetime_album_idx
on public.assets(order_id, category, album_sort_order, created_at)
where category in ('source_image', 'scene_still', 'album_photo');

create or replace function public.validate_album_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visible_count integer;
begin
  if new.category not in ('source_image', 'scene_still', 'album_photo') then
    new.album_visible := false;
    new.album_caption := null;
    return new;
  end if;

  new.album_caption := nullif(trim(coalesce(new.album_caption, '')), '');
  if char_length(coalesce(new.album_caption, '')) > 120 then
    raise exception 'album caption must be 120 characters or fewer';
  end if;
  if new.album_sort_order < 0 then new.album_sort_order := 0; end if;

  -- Source-selection controls stay conservative. Scene stills and lifetime
  -- album photos are paginated and do not have a visible-count ceiling.
  if new.category = 'source_image'
     and new.album_visible
     and (tg_op = 'INSERT' or not coalesce(old.album_visible, false)) then
    select count(*) into v_visible_count
    from public.assets
    where order_id = new.order_id and category = 'source_image'
      and album_visible and id <> new.id;
    if v_visible_count >= 30 then
      raise exception 'production source album can contain up to 30 visible photos';
    end if;
  end if;
  return new;
end;
$$;

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
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_asset_id uuid;
  v_daily_count integer;
  v_total_bytes bigint;
  v_sort_order integer;
begin
  if v_user_id is null then raise exception 'ログインが必要です。'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'JPEG、PNG、WebPの写真を選んでください。';
  end if;
  if p_file_size <= 0 or p_file_size > 20971520 then
    raise exception '写真1枚の上限は20MBです。';
  end if;
  if char_length(trim(coalesce(p_original_filename, ''))) not between 1 and 255 then
    raise exception '写真のファイル名を確認できません。';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and user_id = v_user_id for update;
  if not found or v_order.status <> 'delivered' or not exists (
    select 1 from public.deliveries where order_id = p_order_id
  ) then
    raise exception '完成後のアルバムで写真を追加できます。';
  end if;
  if p_storage_path not like v_user_id::text || '/' || p_order_id::text || '/album/%' then
    raise exception '写真の保存先が正しくありません。';
  end if;

  select count(*)::integer into v_daily_count
  from public.order_events
  where order_id = p_order_id
    and actor_id = v_user_id
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
    p_order_id, v_user_id, 'album_photo', p_storage_path,
    trim(p_original_filename), p_mime_type, p_file_size, true, v_sort_order
  ) returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, v_user_id, 'lifetime_album_photo_uploaded', jsonb_build_object(
    'asset_id', v_asset_id, 'file_size', p_file_size
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
  v_asset public.assets%rowtype;
begin
  select * into v_asset from public.assets
  where id = p_asset_id and user_id = auth.uid() and category = 'album_photo'
  for update;
  if not found then raise exception '追加した写真を確認できませんでした。'; end if;
  delete from public.assets where id = p_asset_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (v_asset.order_id, auth.uid(), 'lifetime_album_photo_deleted', jsonb_build_object(
    'asset_id', p_asset_id
  ));
end;
$$;

-- Album photos must be registered through the guarded RPC above.
drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets for insert to authenticated
with check (
  public.is_admin() or (
    user_id = auth.uid()
    and category in ('source_image', 'source_video')
    and exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
  )
);

drop policy if exists order_assets_delete on storage.objects;
create policy order_assets_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'order-assets' and (
    public.is_admin() or (
      (storage.foldername(name))[1] = auth.uid()::text and (
        exists (
          select 1 from public.assets where storage_path = name
            and user_id = auth.uid()
            and category in ('source_image', 'source_video', 'album_photo')
        )
        or exists (
          select 1 from public.story_draft_assets
          where storage_path = name and user_id = auth.uid()
        )
      )
    )
  )
);

create or replace function public.album_page_for_order(
  p_order_id uuid,
  p_offset integer,
  p_limit integer
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ordered.id,
    'storage_path', ordered.storage_path,
    'caption', ordered.caption,
    'sort_order', ordered.display_order,
    'kind', ordered.category
  ) order by ordered.category_order, ordered.display_order, ordered.created_at), '[]'::jsonb)
  from (
    select asset.id, asset.storage_path, asset.category, asset.created_at,
      case when asset.category = 'scene_still'
        then coalesce(asset.story_caption, asset.scene_title)
        else asset.album_caption end as caption,
      case asset.category when 'scene_still' then 0 when 'source_image' then 1 else 2 end as category_order,
      case when asset.category = 'scene_still' then asset.scene_sort_order else asset.album_sort_order end as display_order
    from public.assets asset
    where asset.order_id = p_order_id
      and (
        (asset.category = 'scene_still' and not exists (
          select 1 from public.assets newer
          where newer.order_id = asset.order_id and newer.category = 'scene_still'
            and newer.scene_sort_order = asset.scene_sort_order
            and (newer.created_at, newer.id) > (asset.created_at, asset.id)
        ))
        or (asset.category = 'source_image' and asset.album_visible)
        or (asset.category = 'album_photo' and asset.album_visible)
      )
    order by category_order, display_order, asset.created_at
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 30), 1), 30)
  ) ordered;
$$;

create or replace function public.album_count_for_order(p_order_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.assets asset
  where asset.order_id = p_order_id and (
    (asset.category = 'scene_still' and not exists (
      select 1 from public.assets newer
      where newer.order_id = asset.order_id and newer.category = 'scene_still'
        and newer.scene_sort_order = asset.scene_sort_order
        and (newer.created_at, newer.id) > (asset.created_at, asset.id)
    ))
    or (asset.category = 'source_image' and asset.album_visible)
    or (asset.category = 'album_photo' and asset.album_visible)
  );
$$;

create or replace function public.get_shared_memory(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.deliveries%rowtype;
  v_concept public.concepts%rowtype;
begin
  select orders.* into v_order
  from public.share_links join public.orders on orders.id = share_links.order_id
  where share_links.token = p_token and share_links.active and orders.status = 'delivered';
  if not found then return null; end if;

  select * into v_delivery from public.deliveries where order_id = v_order.id;
  if not found then return null; end if;
  select * into v_concept from public.concepts
  where order_id = v_order.id and status = 'published'
    and slot = v_order.selected_concept_slot limit 1;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id, 'order_number', v_order.order_number,
      'pet_name', v_order.pet_name, 'breed', v_order.breed,
      'purpose', v_order.purpose, 'message_to_pet', v_order.message_to_pet,
      'created_at', v_order.created_at
    ),
    'delivery', jsonb_build_object(
      'title', v_delivery.title, 'customer_message', v_delivery.customer_message,
      'video_storage_path', (select storage_path from public.assets where id = v_delivery.final_asset_id)
    ),
    'concept', case when v_concept.id is null then null else jsonb_build_object(
      'title', v_concept.title, 'tone', v_concept.tone,
      'summary', v_concept.summary, 'scenes', v_concept.scenes
    ) end,
    'images', public.album_page_for_order(v_order.id, 0, 30),
    'album_total', public.album_count_for_order(v_order.id),
    'character', (
      select jsonb_build_object('storage_path', asset.storage_path)
      from public.assets asset where asset.order_id = v_order.id
        and asset.category = 'character_sprite' limit 1
    )
  );
end;
$$;

create or replace function public.get_shared_memory_by_code(p_share_code text)
returns jsonb language sql security definer set search_path = public as $$
  select public.get_shared_memory(p_share_code);
$$;

create or replace function public.get_shared_memory_by_slug(p_customer_slug text, p_pet_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select public.get_shared_memory(link.token)
  from public.share_links link
  where link.customer_slug = lower(p_customer_slug)
    and link.pet_slug = lower(p_pet_slug) and link.active limit 1;
$$;

create or replace function public.get_shared_album_page_by_code(
  p_share_code text, p_offset integer, p_limit integer default 30
)
returns jsonb language sql security definer set search_path = public as $$
  select public.album_page_for_order(link.order_id, p_offset, p_limit)
  from public.share_links link join public.orders orders on orders.id = link.order_id
  where link.token = p_share_code and link.active and orders.status = 'delivered' limit 1;
$$;

create or replace function public.get_shared_album_page_by_slug(
  p_customer_slug text, p_pet_slug text, p_offset integer, p_limit integer default 30
)
returns jsonb language sql security definer set search_path = public as $$
  select public.album_page_for_order(link.order_id, p_offset, p_limit)
  from public.share_links link join public.orders orders on orders.id = link.order_id
  where link.customer_slug = lower(p_customer_slug)
    and link.pet_slug = lower(p_pet_slug) and link.active
    and orders.status = 'delivered' limit 1;
$$;

create or replace function public.can_read_shared_asset(p_storage_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assets asset
    join public.share_links link on link.order_id = asset.order_id and link.active
    join public.orders orders on orders.id = asset.order_id and orders.status = 'delivered'
    left join public.deliveries delivery on delivery.order_id = asset.order_id
    where asset.storage_path = p_storage_path and (
      (asset.category = 'source_image' and asset.album_visible)
      or asset.category in ('scene_still', 'album_photo', 'character_sprite')
      or (asset.category = 'final_video' and delivery.final_asset_id = asset.id)
    )
  );
$$;

revoke all on function public.album_page_for_order(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.album_count_for_order(uuid) from public, anon, authenticated;
revoke all on function public.register_lifetime_album_photo(uuid, text, text, text, bigint) from public, anon;
revoke all on function public.delete_lifetime_album_photo(uuid) from public, anon;
revoke all on function public.get_shared_memory(text) from public;
revoke all on function public.get_shared_memory_by_code(text) from public;
revoke all on function public.get_shared_memory_by_slug(text, text) from public;
revoke all on function public.get_shared_album_page_by_code(text, integer, integer) from public;
revoke all on function public.get_shared_album_page_by_slug(text, text, integer, integer) from public;
revoke all on function public.can_read_shared_asset(text) from public;

grant execute on function public.register_lifetime_album_photo(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.delete_lifetime_album_photo(uuid) to authenticated;
grant execute on function public.get_shared_memory(text) to anon, authenticated;
grant execute on function public.get_shared_memory_by_code(text) to anon, authenticated;
grant execute on function public.get_shared_memory_by_slug(text, text) to anon, authenticated;
grant execute on function public.get_shared_album_page_by_code(text, integer, integer) to anon, authenticated;
grant execute on function public.get_shared_album_page_by_slug(text, text, integer, integer) to anon, authenticated;
grant execute on function public.can_read_shared_asset(text) to anon, authenticated;
