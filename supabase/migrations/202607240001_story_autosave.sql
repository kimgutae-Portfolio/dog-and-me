-- 申込フォーム（1〜5段階）のサーバー下書きと写真の自動保存

create table if not exists public.story_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  pending_order_id uuid references public.orders(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  current_step smallint not null default 0 check (current_step between 0 and 4),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_draft_assets (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.story_drafts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_key text not null check (char_length(client_key) between 1 and 100),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 209715200),
  sort_order integer not null default 0 check (sort_order between 0 and 29),
  created_at timestamptz not null default now(),
  unique(draft_id, client_key)
);

create index if not exists story_drafts_expires_idx on public.story_drafts(expires_at);
create index if not exists story_draft_assets_draft_idx
on public.story_draft_assets(draft_id, sort_order, created_at);

drop trigger if exists story_drafts_set_updated_at on public.story_drafts;
create trigger story_drafts_set_updated_at before update on public.story_drafts
for each row execute function public.set_updated_at();

alter table public.story_drafts enable row level security;
alter table public.story_draft_assets enable row level security;

drop policy if exists story_drafts_select_own on public.story_drafts;
create policy story_drafts_select_own on public.story_drafts for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists story_draft_assets_select_own on public.story_draft_assets;
create policy story_draft_assets_select_own on public.story_draft_assets for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists story_draft_assets_insert_own on public.story_draft_assets;
create policy story_draft_assets_insert_own on public.story_draft_assets for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.story_drafts draft
    where draft.id = draft_id and draft.user_id = auth.uid()
  )
);

drop policy if exists story_draft_assets_update_own on public.story_draft_assets;
create policy story_draft_assets_update_own on public.story_draft_assets for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.story_drafts draft
    where draft.id = draft_id and draft.user_id = auth.uid()
  )
);

drop policy if exists story_draft_assets_delete_own on public.story_draft_assets;
create policy story_draft_assets_delete_own on public.story_draft_assets for delete to authenticated
using (user_id = auth.uid());

create or replace function public.validate_story_draft_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_count integer;
begin
  select user_id into v_owner from public.story_drafts where id = new.draft_id;
  if v_owner is null or v_owner <> new.user_id then
    raise exception '下書きと写真の所有者が一致しません。';
  end if;

  select count(*)::integer into v_count
  from public.story_draft_assets
  where draft_id = new.draft_id and id <> new.id;
  if v_count >= 30 then raise exception '写真は最大30枚までです。'; end if;
  return new;
end;
$$;

drop trigger if exists story_draft_assets_validate on public.story_draft_assets;
create trigger story_draft_assets_validate
before insert or update on public.story_draft_assets
for each row execute function public.validate_story_draft_asset();

create or replace function public.save_story_draft(
  p_draft_id uuid,
  p_data jsonb,
  p_current_step integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'ログインが必要です。'; end if;
  if jsonb_typeof(coalesce(p_data, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_data, '{}'::jsonb)) > 262144 then
    raise exception '入力内容を保存できませんでした。';
  end if;
  if p_current_step not between 0 and 4 then raise exception '入力段階が正しくありません。'; end if;

  if p_draft_id is not null then
    update public.story_drafts
    set data = p_data, current_step = p_current_step,
        expires_at = now() + interval '7 days'
    where id = p_draft_id and user_id = v_user_id
    returning id into v_id;
  end if;

  if v_id is null then
    insert into public.story_drafts(user_id, data, current_step)
    values (v_user_id, p_data, p_current_step)
    on conflict (user_id) do update
    set data = excluded.data, current_step = excluded.current_step,
        expires_at = now() + interval '7 days'
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.link_story_draft_order(
  p_draft_id uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.story_drafts
    where id = p_draft_id and user_id = auth.uid()
  ) or not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then
    raise exception '下書きの注文を確認できませんでした。';
  end if;

  update public.story_drafts
  set pending_order_id = p_order_id, expires_at = now() + interval '7 days'
  where id = p_draft_id and user_id = auth.uid();
end;
$$;

create or replace function public.promote_story_draft_assets(
  p_draft_id uuid,
  p_order_id uuid
)
returns table(client_key text, asset_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.story_drafts
    where id = p_draft_id and user_id = auth.uid()
  ) or not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'awaiting_materials'
  ) then
    raise exception '写真を注文へ移動できませんでした。';
  end if;

  insert into public.assets(
    order_id, user_id, category, storage_path, original_filename,
    mime_type, file_size, album_visible, album_sort_order
  )
  select
    p_order_id, draft_asset.user_id, 'source_image',
    draft_asset.storage_path, draft_asset.original_filename,
    draft_asset.mime_type, draft_asset.file_size,
    draft_asset.sort_order < 30, draft_asset.sort_order
  from public.story_draft_assets draft_asset
  where draft_asset.draft_id = p_draft_id and draft_asset.user_id = auth.uid()
  on conflict (storage_path) do update
  set order_id = excluded.order_id,
      original_filename = excluded.original_filename,
      mime_type = excluded.mime_type,
      file_size = excluded.file_size,
      album_visible = excluded.album_visible,
      album_sort_order = excluded.album_sort_order;

  return query
  select draft_asset.client_key, asset.id
  from public.story_draft_assets draft_asset
  join public.assets asset on asset.storage_path = draft_asset.storage_path
  where draft_asset.draft_id = p_draft_id
    and draft_asset.user_id = auth.uid()
    and asset.order_id = p_order_id;
end;
$$;

create or replace function public.complete_story_draft(
  p_draft_id uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid() and status = 'materials_submitted'
  ) then
    raise exception '送信済みのご相談を確認できませんでした。';
  end if;
  delete from public.story_drafts
  where id = p_draft_id and user_id = auth.uid()
    and (pending_order_id is null or pending_order_id = p_order_id);
end;
$$;

drop policy if exists order_assets_delete on storage.objects;
create policy order_assets_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'order-assets' and (
    public.is_admin() or (
      (storage.foldername(name))[1] = auth.uid()::text and (
        exists (
          select 1 from public.assets
          where storage_path = name and user_id = auth.uid()
            and category in ('source_image', 'source_video')
        )
        or exists (
          select 1 from public.story_draft_assets
          where storage_path = name and user_id = auth.uid()
        )
      )
    )
  )
);

grant select on public.story_drafts to authenticated;
grant select, insert, update, delete on public.story_draft_assets to authenticated;

revoke all on function public.save_story_draft(uuid, jsonb, integer) from public, anon;
revoke all on function public.link_story_draft_order(uuid, uuid) from public, anon;
revoke all on function public.promote_story_draft_assets(uuid, uuid) from public, anon;
revoke all on function public.complete_story_draft(uuid, uuid) from public, anon;
grant execute on function public.save_story_draft(uuid, jsonb, integer) to authenticated;
grant execute on function public.link_story_draft_order(uuid, uuid) to authenticated;
grant execute on function public.promote_story_draft_assets(uuid, uuid) to authenticated;
grant execute on function public.complete_story_draft(uuid, uuid) to authenticated;
