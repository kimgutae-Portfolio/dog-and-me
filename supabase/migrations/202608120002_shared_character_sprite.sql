-- The share-code page is the customer's actual personal website. Include the
-- operator-managed character in its payload and allow signed read access only
-- while that unguessable share URL is active.

create or replace function public.get_shared_memory_by_code(p_share_code text)
returns jsonb
language sql
security definer set search_path = public
as $$
  with shared as (
    select public.get_shared_memory(p_share_code) as payload
  )
  select case
    when payload is null then null
    else payload || jsonb_build_object(
      'character', (
        select jsonb_build_object('storage_path', asset.storage_path)
        from public.assets as asset
        where asset.order_id = (payload #>> '{order,id}')::uuid
          and asset.category = 'character_sprite'
        limit 1
      )
    )
  end
  from shared;
$$;

revoke all on function public.get_shared_memory_by_code(text) from public;
grant execute on function public.get_shared_memory_by_code(text) to anon, authenticated;

create or replace function public.can_read_shared_asset(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assets as asset
    join public.share_links as link
      on link.order_id = asset.order_id and link.active
    left join public.deliveries as delivery on delivery.order_id = asset.order_id
    where asset.storage_path = p_storage_path
      and (
        (asset.category = 'source_image' and asset.album_visible)
        or (asset.category = 'final_video' and delivery.final_asset_id = asset.id)
        or asset.category = 'character_sprite'
      )
  );
$$;

revoke all on function public.can_read_shared_asset(text) from public;
grant execute on function public.can_read_shared_asset(text) to anon, authenticated;
