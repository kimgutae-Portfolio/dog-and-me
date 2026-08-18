-- Create and activate the permanent personal site as part of delivery itself.
-- The site no longer depends on the customer opening Studio after delivery.

create or replace function public.ensure_public_personal_site(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_slug text;
  v_pet_slug text;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and status = 'delivered';

  if not found then
    return;
  end if;

  select
    public.personal_site_slug(split_part(profile.email, '@', 1), 'family'),
    public.personal_site_slug(v_order.pet_name, 'dog')
  into v_customer_slug, v_pet_slug
  from public.profiles as profile
  where profile.id = v_order.user_id;

  if v_customer_slug is null or v_pet_slug is null then
    raise exception 'personal site slugs could not be created';
  end if;

  if exists (
    select 1 from public.share_links as existing
    where existing.order_id <> v_order.id
      and existing.customer_slug = v_customer_slug
      and existing.pet_slug = v_pet_slug
  ) then
    v_pet_slug := left(v_pet_slug, 71) || '-' ||
      left(replace(v_order.id::text, '-', ''), 8);
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

revoke all on function public.ensure_public_personal_site(uuid) from public, anon, authenticated;

create or replace function public.publish_personal_site_after_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' then
    perform public.ensure_public_personal_site(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.publish_personal_site_after_delivery() from public, anon, authenticated;

drop trigger if exists orders_publish_personal_site_after_delivery on public.orders;
create trigger orders_publish_personal_site_after_delivery
after insert or update of status on public.orders
for each row
when (new.status = 'delivered')
execute function public.publish_personal_site_after_delivery();

do $$
declare
  v_order_id uuid;
begin
  for v_order_id in
    select id from public.orders where status = 'delivered'
  loop
    perform public.ensure_public_personal_site(v_order_id);
  end loop;
end;
$$;
