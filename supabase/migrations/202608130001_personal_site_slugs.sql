-- Human-readable personal website URLs: /{email-local-part}/{pet-name}.
-- The existing secret share code remains valid for backward compatibility.

alter table public.share_links
  add column if not exists customer_slug text,
  add column if not exists pet_slug text;

create or replace function public.personal_site_slug(p_value text, p_fallback text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(
    coalesce(
      nullif(
        trim(both '-' from regexp_replace(lower(trim(coalesce(p_value, ''))), '[^a-z0-9ぁ-んァ-ヶ一-龠々ー가-힣]+', '-', 'g')),
        ''
      ),
      p_fallback
    ),
    80
  );
$$;

update public.share_links as link
set
  customer_slug = public.personal_site_slug(split_part(profile.email, '@', 1), 'family'),
  pet_slug = public.personal_site_slug(orders.pet_name, 'dog')
from public.orders as orders
join public.profiles as profile on profile.id = orders.user_id
where link.order_id = orders.id
  and (link.customer_slug is null or link.pet_slug is null);

with duplicates as (
  select id, row_number() over (
    partition by customer_slug, pet_slug order by created_at, id
  ) as position
  from public.share_links
)
update public.share_links as link
set pet_slug = left(link.pet_slug, 71) || '-' || left(replace(link.id::text, '-', ''), 8)
from duplicates
where duplicates.id = link.id and duplicates.position > 1;

create unique index if not exists share_links_personal_slug_idx
on public.share_links(customer_slug, pet_slug);

drop function if exists public.manage_memory_site(uuid, text);
create function public.manage_memory_site(p_order_id uuid, p_action text)
returns table(code text, active boolean, customer_slug text, pet_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
  v_customer_slug text;
  v_pet_slug text;
begin
  select result.token, result.active
  into v_result
  from public.manage_memory_share(p_order_id, p_action) result;

  select
    public.personal_site_slug(split_part(profile.email, '@', 1), 'family'),
    public.personal_site_slug(orders.pet_name, 'dog')
  into v_customer_slug, v_pet_slug
  from public.orders as orders
  join public.profiles as profile on profile.id = orders.user_id
  where orders.id = p_order_id;

  begin
    update public.share_links as link
    set customer_slug = coalesce(link.customer_slug, v_customer_slug),
        pet_slug = coalesce(link.pet_slug, v_pet_slug)
    where link.order_id = p_order_id;
  exception when unique_violation then
    update public.share_links as link
    set customer_slug = v_customer_slug,
        pet_slug = left(v_pet_slug, 71) || '-' || left(replace(link.id::text, '-', ''), 8)
    where link.order_id = p_order_id;
  end;

  return query
  select link.token, link.active, link.customer_slug, link.pet_slug
  from public.share_links as link
  where link.order_id = p_order_id;
end;
$$;

revoke all on function public.manage_memory_site(uuid, text) from public, anon;
grant execute on function public.manage_memory_site(uuid, text) to authenticated;

create or replace function public.get_shared_memory_by_slug(
  p_customer_slug text,
  p_pet_slug text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.get_shared_memory(link.token)
  from public.share_links as link
  where link.customer_slug = lower(p_customer_slug)
    and link.pet_slug = lower(p_pet_slug)
    and link.active
  limit 1;
$$;

revoke all on function public.get_shared_memory_by_slug(text, text) from public;
grant execute on function public.get_shared_memory_by_slug(text, text) to anon, authenticated;
