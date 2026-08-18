-- The customer manages both production-source captions and post-delivery
-- album-photo captions from Studio. Upload and deletion remain guarded RPCs.

drop policy if exists assets_update_album_own on public.assets;
create policy assets_update_album_own on public.assets
for update to authenticated
using (
  (user_id = auth.uid() or public.is_admin())
  and category in ('source_image', 'album_photo')
)
with check (
  (user_id = auth.uid() or public.is_admin())
  and category in ('source_image', 'album_photo')
);
