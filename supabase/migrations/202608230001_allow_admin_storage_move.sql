-- Supabase Storage move() renames an object through an UPDATE on
-- storage.objects. Admin video publication moves an assembled film from the
-- private admin namespace into the customer's readable namespace.

drop policy if exists order_assets_update on storage.objects;
create policy order_assets_update on storage.objects for update to authenticated
using (
  bucket_id = 'order-assets' and public.is_admin()
)
with check (
  bucket_id = 'order-assets' and public.is_admin()
);
