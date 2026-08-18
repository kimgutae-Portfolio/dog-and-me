-- Reuse the memory text the customer supplied during production as the
-- initial album caption for each source photo. Customers can still edit it in
-- Studio afterwards.

update public.assets as asset
set album_caption = left(memory.description, 120)
from public.order_memories as memory
where asset.memory_id = memory.id
  and asset.category = 'source_image'
  and nullif(trim(coalesce(asset.album_caption, '')), '') is null;

create or replace function public.default_source_photo_album_caption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category = 'source_image'
     and new.memory_id is not null
     and nullif(trim(coalesce(new.album_caption, '')), '') is null then
    select left(memory.description, 120)
    into new.album_caption
    from public.order_memories as memory
    where memory.id = new.memory_id;
  end if;
  return new;
end;
$$;

drop trigger if exists assets_default_source_photo_caption on public.assets;
create trigger assets_default_source_photo_caption
before insert or update of memory_id, category on public.assets
for each row execute function public.default_source_photo_album_caption();

revoke all on function public.default_source_photo_album_caption() from public, anon, authenticated;
