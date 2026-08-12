-- One operator-managed character sprite per order. This asset never enters the
-- customer still-review workflow and can be registered at any production stage.

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check check (category in (
  'source_image', 'source_video', 'scene_still', 'render_clip',
  'transition_clip', 'assembled_film', 'review_video', 'final_video',
  'thumbnail', 'character_sprite'
));

create unique index if not exists assets_character_sprite_order_idx
  on public.assets(order_id) where category = 'character_sprite';

create or replace function public.admin_register_character_sprite(
  p_order_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_asset_id uuid;
  v_replaced_path text;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_mime_type not in ('image/png', 'image/webp') then raise exception 'character sprite must be PNG or WebP'; end if;
  if p_file_size <= 0 or p_file_size > 52428800 then raise exception 'invalid character sprite file size'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if p_storage_path not like 'admin/' || v_order.id::text || '/character/%' then raise exception 'invalid storage path'; end if;

  select storage_path into v_replaced_path
  from public.assets
  where order_id = p_order_id and category = 'character_sprite'
  for update;

  delete from public.assets
  where order_id = p_order_id and category = 'character_sprite';

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename, mime_type,
    file_size, scene_title, scene_sort_order
  ) values (
    p_order_id, v_order.user_id, 'character_sprite', p_storage_path,
    p_original_filename, p_mime_type, p_file_size, 'Website character sprite', 0
  ) returning id into v_asset_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (
    p_order_id, auth.uid(), 'character_sprite_registered',
    jsonb_build_object('asset_id', v_asset_id, 'filename', p_original_filename, 'replaced', v_replaced_path is not null)
  );

  return jsonb_build_object('asset_id', v_asset_id, 'replaced_storage_path', v_replaced_path);
end;
$$;

create or replace function public.admin_delete_character_sprite(p_asset_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_asset public.assets%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_asset from public.assets where id = p_asset_id for update;
  if not found then raise exception 'character sprite not found'; end if;
  if v_asset.category <> 'character_sprite' then raise exception 'asset is not a character sprite'; end if;

  delete from public.assets where id = p_asset_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (v_asset.order_id, auth.uid(), 'character_sprite_deleted', jsonb_build_object('asset_id', p_asset_id));
  return v_asset.storage_path;
end;
$$;

revoke all on function public.admin_register_character_sprite(uuid, text, text, text, bigint) from public, anon;
revoke all on function public.admin_delete_character_sprite(uuid) from public, anon;
grant execute on function public.admin_register_character_sprite(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.admin_delete_character_sprite(uuid) to authenticated;
