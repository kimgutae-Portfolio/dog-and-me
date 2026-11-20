-- Current customer address behavior, kept self-contained so this fixture does
-- not depend on operator-only migration files excluded from the repository.
alter table public.share_links add column custom_slug text unique;
alter table public.share_links add column initial_slug text;
create table public.memory_addresses (
  address text primary key,
  order_id uuid not null references public.orders(id) on delete cascade
);

create or replace function public.ensure_public_personal_site(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_initial text; v_candidate text; v_inserted text;
begin
  select * into v_order from public.orders where id=p_order_id and status='delivered' for update;
  if not found then return; end if;
  insert into public.share_links(order_id,user_id,active) values(v_order.id,v_order.user_id,true)
    on conflict(order_id) do update set active=true;
  select initial_slug into v_initial from public.share_links where order_id=p_order_id;
  if v_initial is not null then return; end if;
  loop
    v_candidate := substr(md5(gen_random_uuid()::text),1,6);
    insert into public.memory_addresses(address,order_id) values(v_candidate,p_order_id)
      on conflict(address) do nothing returning address into v_inserted;
    exit when v_inserted is not null;
  end loop;
  update public.share_links set initial_slug=v_candidate where order_id=p_order_id;
end;
$$;
revoke all on function public.ensure_public_personal_site(uuid) from public, anon, authenticated;

create function public.manage_memory_address(
  p_order_id uuid, p_action text default 'get', p_slug text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_link public.share_links%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or (v_order.user_id<>auth.uid() and not public.is_admin()) then raise exception 'order not found'; end if;
  if v_order.status<>'delivered' then raise exception 'delivery required'; end if;
  if p_action is null or p_action not in ('get','check','set') then raise exception 'invalid action'; end if;
  perform public.ensure_public_personal_site(p_order_id);
  select * into v_link from public.share_links where order_id=p_order_id for update;
  if p_action='get' then
    return jsonb_build_object('code',v_link.token,'active',v_link.active,'custom_slug',v_link.custom_slug,'initial_slug',v_link.initial_slug);
  end if;
  if p_slug is null or char_length(p_slug) not between 3 and 40 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_slug in ('admin','api','auth','new','edit','preview','support') then return jsonb_build_object('status','invalid'); end if;
  if v_link.custom_slug is not null and v_link.custom_slug<>p_slug then return jsonb_build_object('status','locked'); end if;
  if v_link.custom_slug is null and v_link.initial_slug=p_slug then return jsonb_build_object('status','current'); end if;
  if exists(select 1 from public.memory_addresses where address=p_slug and order_id<>p_order_id) then
    return jsonb_build_object('status','taken');
  end if;
  if p_action='check' then return jsonb_build_object('status','available'); end if;
  begin
    if v_link.custom_slug is null then
      insert into public.memory_addresses(address,order_id) values(p_slug,p_order_id);
      update public.share_links set custom_slug=p_slug where order_id=p_order_id;
    end if;
  exception when unique_violation then return jsonb_build_object('status','taken');
  end;
  return jsonb_build_object('status','saved','code',v_link.token,'active',v_link.active,'custom_slug',p_slug,'initial_slug',v_link.initial_slug);
end;
$$;
revoke all on function public.manage_memory_address(uuid,text,text) from public, anon;
grant execute on function public.manage_memory_address(uuid,text,text) to authenticated;

create function public.get_shared_memory_by_address(p_address text)
returns jsonb language sql stable security definer set search_path=public as $$
  select public.delivered_memory_for_order(order_id) from public.memory_addresses where address=p_address;
$$;
