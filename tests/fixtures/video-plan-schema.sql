-- Disposable local database only. Extend the existing focused pricing schema
-- with the real service tables used by the plan, consent and delivery RPCs.
-- Pass -v video_plan_legacy_pricing=true to retain the deployed first-20
-- launch pricing instead of installing the optional permanent-price migration.
\if :{?video_plan_legacy_pricing}
\else
\set video_plan_legacy_pricing false
\endif
\i tests/fixtures/permanent-pricing-schema.sql

alter table public.orders
  add column updated_at timestamptz default now(),
  add column created_at timestamptz default now(),
  add column selected_concept_slot text,
  add column customer_approved_at timestamptz,
  add column customer_approved_review_asset_id uuid,
  add column currency text default 'JPY';
alter table public.order_events add column created_at timestamptz default now();
alter table public.assets
  add column storage_path text,
  add column original_filename text,
  add column mime_type text,
  add column file_size bigint default 1,
  add column album_visible boolean default false,
  add column album_caption text,
  add column album_sort_order integer default 0,
  add column scene_title text,
  add column story_caption text,
  add column scene_sort_order integer default 0,
  add column created_at timestamptz default now();

create table public.profiles (id uuid primary key, email text);
create table public.concepts (
  id uuid primary key default gen_random_uuid(), order_id uuid, slot text,
  title text, tone text, summary text, scenes jsonb, status text
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(), order_id uuid unique,
  final_asset_id uuid, title text, customer_message text, delivered_at timestamptz
);
create table public.revision_requests (
  id uuid primary key default gen_random_uuid(), order_id uuid, status text
);
create table public.share_links (
  order_id uuid primary key, user_id uuid, active boolean default true,
  token text default replace(gen_random_uuid()::text, '-', ''),
  customer_slug text, pet_slug text
);
create schema storage;
create table storage.buckets(id text, allowed_mime_types text[]);
create table storage.objects(bucket_id text, name text);
create function storage.foldername(text) returns text[] language sql immutable as $$
  select string_to_array($1, '/');
$$;
create table public.story_draft_assets(storage_path text, user_id uuid);

create function public.is_admin() returns boolean language sql stable as $$
  select coalesce(current_setting('test.is_admin', true) = 'true', false);
$$;
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon, service_role;

-- This is the currently deployed delivery RPC from
-- 202607210003_release_readiness.sql, including all fulfillment gates.
create function public.admin_deliver_order(
  p_order_id uuid, p_asset_id uuid, p_title text, p_customer_message text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'delivery title required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'payment must be confirmed before delivery'; end if;
  if v_order.status <> 'quality_check' then raise exception 'delivery requires quality_check status'; end if;
  if v_order.customer_approved_at is null or v_order.customer_approved_review_asset_id is null then
    raise exception 'customer approval required before delivery';
  end if;
  if exists (select 1 from public.revision_requests where order_id = p_order_id and status = 'open') then
    raise exception 'open revision must be resolved before delivery';
  end if;
  if not exists (
    select 1 from public.assets where id = p_asset_id and order_id = p_order_id and category = 'final_video'
  ) then raise exception 'final video asset not found'; end if;

  insert into public.deliveries(order_id, final_asset_id, title, customer_message, delivered_at)
  values (p_order_id, p_asset_id, trim(p_title), nullif(trim(coalesce(p_customer_message, '')), ''), now())
  on conflict (order_id) do update
  set final_asset_id = excluded.final_asset_id, title = excluded.title,
    customer_message = excluded.customer_message, delivered_at = now();
  update public.orders set status = 'delivered', stage_updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_delivered', jsonb_build_object(
    'asset_id', p_asset_id, 'title', trim(p_title),
    'customer_approved_at', v_order.customer_approved_at,
    'approved_review_asset_id', v_order.customer_approved_review_asset_id
  ));
end;
$$;

\i supabase/migrations/202607300002_consent_style_version_alignment.sql
\i supabase/migrations/202608050002_launch_price_19800.sql
\i supabase/migrations/202608070001_fix_create_memory_order_consent_version.sql
\i supabase/migrations/202608170004_launch_price_16800.sql
\i supabase/migrations/202608250004_launch_monitor_limit_twenty.sql
\i supabase/migrations/202608290001_launch_price_12800.sql

do $$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.order_has_current_consents(uuid)', 'public.create_memory_order(jsonb)',
    'public.save_memory_order_draft(uuid,jsonb)',
    'public.accept_order_consents(uuid,text,text,text,text,text,boolean,boolean,boolean)'
  ] loop
    execute replace(replace(
      pg_get_functiondef(v_signature::regprocedure),
      '2026-07-29-style-v2', '2026-08-23-revision-2-1-v1'
    ), '2026-08-02-storybook-v1', '2026-08-23-revision-2-1-v1');
  end loop;
end;
$$;
\if :video_plan_legacy_pricing
\echo 'Fixture: legacy first-20 launch pricing'
\else
\i supabase/migrations/202610150001_permanent_memory_film_price.sql
\endif
\i supabase/migrations/202608180001_lifetime_photo_album.sql
\i supabase/migrations/202608180002_always_public_personal_sites.sql
\i supabase/migrations/202608180003_auto_publish_delivered_personal_sites.sql
\i supabase/migrations/202608180004_delivered_sites_are_public.sql
\i supabase/migrations/202608240001_admin_delivered_website_management.sql
\i supabase/migrations/202608270001_line_sticker_service.sql
\i supabase/migrations/202608300001_personal_site_met_date.sql
\i tests/fixtures/video-plan-addresses.sql
