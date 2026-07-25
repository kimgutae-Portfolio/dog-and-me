-- Apply manually only after the RPC-based admin UI has been deployed and smoke-tested.

drop policy if exists orders_admin_update on public.orders;
drop policy if exists concepts_admin_all on public.concepts;
drop policy if exists revisions_insert on public.revision_requests;
drop policy if exists revisions_admin_update on public.revision_requests;
drop policy if exists deliveries_admin_all on public.deliveries;
drop policy if exists order_events_admin_insert on public.order_events;

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets for insert to authenticated
with check (
  user_id = auth.uid()
  and category in ('source_image', 'source_video')
  and exists (
    select 1 from public.orders
    where id = order_id and user_id = auth.uid() and status <> 'cancelled'
  )
);

drop policy if exists order_assets_insert on storage.objects;
create policy order_assets_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'order-assets' and (
    public.is_admin() or (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1 from public.orders
        where user_id = auth.uid()
          and id::text = (storage.foldername(name))[2]
          and status <> 'cancelled'
      )
    )
  )
);

drop policy if exists assets_delete_own_source on public.assets;
create policy assets_delete_own_source on public.assets for delete to authenticated
using (user_id = auth.uid() and category in ('source_image', 'source_video'));

drop policy if exists assets_update_album_own on public.assets;
create policy assets_update_album_own on public.assets for update to authenticated
using (user_id = auth.uid() and category = 'source_image')
with check (user_id = auth.uid() and category = 'source_image');

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and status = 'open'
  and resolved_at is null
  and resolved_by is null
  and exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
);

revoke update on public.orders from authenticated;
revoke insert, update, delete on public.concepts from authenticated;
revoke insert, update on public.revision_requests from authenticated;
revoke insert, update, delete on public.deliveries from authenticated;
revoke insert on public.order_events from authenticated;

grant select on public.orders, public.concepts, public.revision_requests, public.deliveries, public.order_events to authenticated;
grant select, insert on public.messages to authenticated;
