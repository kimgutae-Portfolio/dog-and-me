-- Browser push subscriptions and the durable notification inbox for operators.
create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_push_subscriptions_admin_idx
  on public.admin_push_subscriptions(admin_user_id, last_seen_at desc);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  href text not null,
  dedupe_key text not null,
  push_status text not null default 'pending'
    check (push_status in ('pending', 'sent', 'failed', 'not_subscribed', 'not_configured', 'expired')),
  delivery_count integer not null default 0,
  error_message text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(admin_user_id, dedupe_key)
);

create index if not exists admin_notifications_admin_created_idx
  on public.admin_notifications(admin_user_id, created_at desc);

alter table public.admin_push_subscriptions enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists admin_push_subscriptions_select on public.admin_push_subscriptions;
create policy admin_push_subscriptions_select on public.admin_push_subscriptions
  for select to authenticated
  using (admin_user_id = auth.uid() and public.is_admin());

drop policy if exists admin_push_subscriptions_insert on public.admin_push_subscriptions;
create policy admin_push_subscriptions_insert on public.admin_push_subscriptions
  for insert to authenticated
  with check (admin_user_id = auth.uid() and public.is_admin());

drop policy if exists admin_push_subscriptions_update on public.admin_push_subscriptions;
create policy admin_push_subscriptions_update on public.admin_push_subscriptions
  for update to authenticated
  using (admin_user_id = auth.uid() and public.is_admin())
  with check (admin_user_id = auth.uid() and public.is_admin());

drop policy if exists admin_push_subscriptions_delete on public.admin_push_subscriptions;
create policy admin_push_subscriptions_delete on public.admin_push_subscriptions
  for delete to authenticated
  using (admin_user_id = auth.uid() and public.is_admin());

drop policy if exists admin_notifications_select on public.admin_notifications;
create policy admin_notifications_select on public.admin_notifications
  for select to authenticated
  using (admin_user_id = auth.uid() and public.is_admin());

drop policy if exists admin_notifications_update on public.admin_notifications;
create policy admin_notifications_update on public.admin_notifications
  for update to authenticated
  using (admin_user_id = auth.uid() and public.is_admin())
  with check (admin_user_id = auth.uid() and public.is_admin());

grant select, insert, update, delete on public.admin_push_subscriptions to authenticated;
grant select, update on public.admin_notifications to authenticated;

