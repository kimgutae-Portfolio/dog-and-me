-- LINE sticker production is currently included at no additional charge.
-- Consent is recorded separately from the core film consent so existing orders
-- are not blocked by the optional external marketplace workflow.

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check check (category in (
  'source_image', 'source_video', 'scene_still', 'render_clip',
  'transition_clip', 'assembled_film', 'review_video', 'final_video',
  'thumbnail', 'character_sprite', 'album_photo',
  'line_sticker_preview', 'line_sticker_package'
));

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/quicktime', 'application/zip',
  'application/x-zip-compressed'
]
where id = 'order-assets';

create table if not exists public.line_sticker_deliveries (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null default 'awaiting_consent' check (status in (
    'awaiting_consent', 'production', 'ready', 'submitted', 'on_sale', 'stopped'
  )),
  preview_asset_id uuid references public.assets(id) on delete set null,
  package_asset_id uuid references public.assets(id) on delete set null,
  store_url text,
  consented_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    store_url is null or (
      char_length(store_url) <= 1000
      and store_url ~ '^https://(store\.line\.me|line\.me)/'
    )
  )
);

drop trigger if exists line_sticker_deliveries_set_updated_at on public.line_sticker_deliveries;
create trigger line_sticker_deliveries_set_updated_at
before update on public.line_sticker_deliveries
for each row execute function public.set_updated_at();

alter table public.line_sticker_deliveries enable row level security;
drop policy if exists line_sticker_deliveries_select on public.line_sticker_deliveries;
create policy line_sticker_deliveries_select
on public.line_sticker_deliveries for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.orders
    where orders.id = line_sticker_deliveries.order_id
      and orders.user_id = auth.uid()
  )
);

insert into public.line_sticker_deliveries(order_id)
select id from public.orders
on conflict (order_id) do nothing;

create or replace function public.create_line_sticker_delivery_for_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.line_sticker_deliveries(order_id)
  values (new.id)
  on conflict (order_id) do nothing;
  return new;
end;
$$;

drop trigger if exists orders_create_line_sticker_delivery on public.orders;
create trigger orders_create_line_sticker_delivery
after insert on public.orders
for each row execute function public.create_line_sticker_delivery_for_order();

create or replace function public.accept_line_sticker_consent(
  p_order_id uuid,
  p_consent_version text,
  p_accepted boolean
)
returns public.line_sticker_deliveries
language plpgsql
security definer set search_path = public
as $$
declare
  v_result public.line_sticker_deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  if not p_accepted then raise exception 'LINEスタンプ制作への同意が必要です。'; end if;
  if p_consent_version is distinct from '2026-08-27-line-sticker-v1' then
    raise exception '最新のLINEスタンプ同意内容をご確認ください。';
  end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status <> 'cancelled'
  ) then raise exception '注文を確認できませんでした。'; end if;

  insert into public.line_sticker_deliveries(
    order_id, status, consented_at, consent_version
  ) values (
    p_order_id, 'production', now(), p_consent_version
  )
  on conflict (order_id) do update set
    status = case
      when line_sticker_deliveries.status = 'awaiting_consent' then 'production'
      else line_sticker_deliveries.status
    end,
    consented_at = now(),
    consent_version = excluded.consent_version
  returning * into v_result;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'line_sticker_consent_accepted', jsonb_build_object(
    'consent_version', p_consent_version,
    'sales_revenue_owner', 'wan_memory',
    'customer_purchase_required', true
  ));
  return v_result;
end;
$$;

create or replace function public.admin_register_line_sticker_delivery(
  p_order_id uuid,
  p_preview_storage_path text,
  p_preview_original_filename text,
  p_preview_mime_type text,
  p_preview_file_size bigint,
  p_package_storage_path text default null,
  p_package_original_filename text default null,
  p_package_mime_type text default null,
  p_package_file_size bigint default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.line_sticker_deliveries%rowtype;
  v_preview_id uuid;
  v_package_id uuid;
  v_replaced_preview_path text;
  v_replaced_package_path text;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  insert into public.line_sticker_deliveries(order_id)
  values (p_order_id)
  on conflict (order_id) do nothing;
  select * into v_delivery from public.line_sticker_deliveries
  where order_id = p_order_id for update;
  if v_delivery.consented_at is null
     or v_delivery.consent_version is distinct from '2026-08-27-line-sticker-v1' then
    raise exception 'current LINE sticker consent required';
  end if;

  if p_preview_mime_type not in ('image/png', 'image/webp', 'image/jpeg') then
    raise exception 'preview must be PNG, WebP or JPEG';
  end if;
  if p_preview_file_size <= 0 or p_preview_file_size > 20971520 then
    raise exception 'invalid preview file size';
  end if;
  if p_preview_storage_path not like v_order.user_id::text || '/' || p_order_id::text || '/line-stickers/preview/%' then
    raise exception 'invalid preview storage path';
  end if;

  if p_package_storage_path is not null then
    if p_package_mime_type not in ('application/zip', 'application/x-zip-compressed') then
      raise exception 'package must be ZIP';
    end if;
    if coalesce(p_package_file_size, 0) <= 0 or p_package_file_size > 104857600 then
      raise exception 'invalid package file size';
    end if;
    if p_package_storage_path not like 'admin/' || p_order_id::text || '/line-stickers/package/%' then
      raise exception 'invalid package storage path';
    end if;
  end if;

  select storage_path into v_replaced_preview_path
  from public.assets where id = v_delivery.preview_asset_id;
  select storage_path into v_replaced_package_path
  from public.assets where id = v_delivery.package_asset_id;

  if v_delivery.preview_asset_id is not null then
    delete from public.assets where id = v_delivery.preview_asset_id;
  end if;
  if v_delivery.package_asset_id is not null then
    delete from public.assets where id = v_delivery.package_asset_id;
  end if;

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename,
    mime_type, file_size, scene_title, scene_sort_order
  ) values (
    p_order_id, v_order.user_id, 'line_sticker_preview',
    p_preview_storage_path, p_preview_original_filename, p_preview_mime_type,
    p_preview_file_size, 'LINE sticker preview', 0
  ) returning id into v_preview_id;

  if p_package_storage_path is not null then
    insert into public.assets(
      order_id, user_id, category, storage_path, original_filename,
      mime_type, file_size, scene_title, scene_sort_order
    ) values (
      p_order_id, v_order.user_id, 'line_sticker_package',
      p_package_storage_path, p_package_original_filename, p_package_mime_type,
      p_package_file_size, 'LINE sticker registration package', 0
    ) returning id into v_package_id;
  end if;

  update public.line_sticker_deliveries set
    status = 'ready',
    preview_asset_id = v_preview_id,
    package_asset_id = v_package_id
  where order_id = p_order_id;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'line_sticker_delivery_registered', jsonb_build_object(
    'preview_asset_id', v_preview_id,
    'package_asset_id', v_package_id,
    'replaced', v_replaced_preview_path is not null
  ));

  return jsonb_build_object(
    'preview_asset_id', v_preview_id,
    'package_asset_id', v_package_id,
    'replaced_preview_storage_path', v_replaced_preview_path,
    'replaced_package_storage_path', v_replaced_package_path
  );
end;
$$;

create or replace function public.admin_update_line_sticker_status(
  p_order_id uuid,
  p_status text,
  p_store_url text default null
)
returns public.line_sticker_deliveries
language plpgsql
security definer set search_path = public
as $$
declare
  v_result public.line_sticker_deliveries%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if p_status not in ('ready', 'submitted', 'on_sale', 'stopped') then
    raise exception 'invalid LINE sticker status';
  end if;
  if p_status = 'on_sale' and coalesce(trim(p_store_url), '') = '' then
    raise exception 'LINE STORE URL required';
  end if;
  if nullif(trim(coalesce(p_store_url, '')), '') is not null
     and trim(p_store_url) !~ '^https://(store\.line\.me|line\.me)/' then
    raise exception 'valid LINE STORE URL required';
  end if;
  update public.line_sticker_deliveries set
    status = p_status,
    store_url = nullif(trim(coalesce(p_store_url, '')), '')
  where order_id = p_order_id and preview_asset_id is not null
  returning * into v_result;
  if not found then raise exception 'LINE sticker delivery not found'; end if;

  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'line_sticker_status_updated', jsonb_build_object(
    'status', p_status, 'store_url', v_result.store_url
  ));
  return v_result;
end;
$$;

revoke all on table public.line_sticker_deliveries from public, anon;
grant select on public.line_sticker_deliveries to authenticated;
revoke all on function public.create_line_sticker_delivery_for_order() from public, anon, authenticated;
revoke all on function public.accept_line_sticker_consent(uuid, text, boolean) from public, anon;
revoke all on function public.admin_register_line_sticker_delivery(uuid, text, text, text, bigint, text, text, text, bigint) from public, anon;
revoke all on function public.admin_update_line_sticker_status(uuid, text, text) from public, anon;
grant execute on function public.accept_line_sticker_consent(uuid, text, boolean) to authenticated;
grant execute on function public.admin_register_line_sticker_delivery(uuid, text, text, text, bigint, text, text, text, bigint) to authenticated;
grant execute on function public.admin_update_line_sticker_status(uuid, text, text) to authenticated;
