-- Repeated pet names under the same customer use readable sequential URLs:
-- /customer/moka, /customer/moka-2, /customer/moka-3, ...

create or replace function public.next_personal_pet_slug(
  p_customer_slug text,
  p_base_pet_slug text,
  p_order_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_number integer := 1;
  v_candidate text := p_base_pet_slug;
begin
  loop
    if not exists (
      select 1
      from public.share_links as link
      where link.customer_slug = p_customer_slug
        and link.pet_slug = v_candidate
        and (p_order_id is null or link.order_id <> p_order_id)
    ) then
      return v_candidate;
    end if;

    v_number := v_number + 1;
    v_candidate := left(
      p_base_pet_slug,
      greatest(1, 80 - char_length('-' || v_number::text))
    ) || '-' || v_number::text;
  end loop;
end;
$$;

create or replace function public.ensure_public_personal_site(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_slug text;
  v_base_pet_slug text;
  v_pet_slug text;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and status = 'delivered';

  if not found then return; end if;

  select
    public.personal_site_slug(split_part(profile.email, '@', 1), 'family'),
    public.personal_site_slug(v_order.pet_name, 'dog')
  into v_customer_slug, v_base_pet_slug
  from public.profiles as profile
  where profile.id = v_order.user_id;

  if v_customer_slug is null or v_base_pet_slug is null then
    raise exception 'personal site slugs could not be created';
  end if;

  -- Serialize allocations for the same account and pet name so simultaneous
  -- deliveries cannot choose the same suffix.
  perform pg_advisory_xact_lock(
    hashtextextended(v_customer_slug || '/' || v_base_pet_slug, 0)
  );

  select link.pet_slug into v_pet_slug
  from public.share_links as link
  where link.order_id = p_order_id;

  if v_pet_slug is null then
    v_pet_slug := public.next_personal_pet_slug(
      v_customer_slug,
      v_base_pet_slug,
      p_order_id
    );
  end if;

  insert into public.share_links as link (
    order_id, user_id, active, customer_slug, pet_slug
  ) values (
    v_order.id, v_order.user_id, true, v_customer_slug, v_pet_slug
  )
  on conflict (order_id) do update
  set active = true,
      customer_slug = coalesce(link.customer_slug, excluded.customer_slug),
      pet_slug = coalesce(link.pet_slug, excluded.pet_slug);
end;
$$;

create or replace function public.manage_memory_site(p_order_id uuid, p_action text)
returns table(code text, active boolean, customer_slug text, pet_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
  v_customer_slug text;
  v_base_pet_slug text;
  v_pet_slug text;
begin
  select result.token, result.active
  into v_result
  from public.manage_memory_share(p_order_id, p_action) result;

  select
    public.personal_site_slug(split_part(profile.email, '@', 1), 'family'),
    public.personal_site_slug(orders.pet_name, 'dog')
  into v_customer_slug, v_base_pet_slug
  from public.orders as orders
  join public.profiles as profile on profile.id = orders.user_id
  where orders.id = p_order_id;

  if v_customer_slug is null or v_base_pet_slug is null then
    raise exception 'personal site slugs could not be created';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_customer_slug || '/' || v_base_pet_slug, 0)
  );

  select link.pet_slug into v_pet_slug
  from public.share_links as link
  where link.order_id = p_order_id;

  if v_pet_slug is null then
    v_pet_slug := public.next_personal_pet_slug(
      v_customer_slug,
      v_base_pet_slug,
      p_order_id
    );
  end if;

  update public.share_links as link
  set customer_slug = coalesce(link.customer_slug, v_customer_slug),
      pet_slug = coalesce(link.pet_slug, v_pet_slug),
      active = true
  where link.order_id = p_order_id;

  return query
  select link.token, true, link.customer_slug, link.pet_slug
  from public.share_links as link
  where link.order_id = p_order_id;
end;
$$;

revoke all on function public.next_personal_pet_slug(text, text, uuid) from public, anon, authenticated;
revoke all on function public.ensure_public_personal_site(uuid) from public, anon, authenticated;
revoke all on function public.manage_memory_site(uuid, text) from public, anon;
grant execute on function public.manage_memory_site(uuid, text) to authenticated;
