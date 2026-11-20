-- Video-only orders keep the same production/review workflow. The selected
-- plan is fixed when materials are submitted and determines delivery benefits.
begin;

alter table public.orders
  add column plan_id text not null default 'memory-film'
  check (plan_id in ('memory-film', 'video-only'));

-- Normalize future full-plan prices without changing any existing quote,
-- including a quote whose Stripe checkout has already been issued.
alter table public.orders alter column regular_price set default 12800;

create or replace function public.get_memory_film_pricing()
returns table(
  current_price integer, regular_price integer, launch_limit integer,
  launch_used integer, launch_remaining integer, campaign_active boolean
)
language sql stable security definer set search_path = public as $$
  select 12800, 12800, 0, 0, 0, false;
$$;
revoke all on function public.get_memory_film_pricing() from public;
grant execute on function public.get_memory_film_pricing() to anon, authenticated;

create function public.memory_plan_price(p_plan_id text)
returns integer language plpgsql immutable set search_path = public as $$
begin
  case p_plan_id
    when 'memory-film' then return 12800;
    when 'video-only' then return 7800;
    else raise exception 'invalid memory plan';
  end case;
end;
$$;
revoke all on function public.memory_plan_price(text) from public, anon, authenticated;

-- Modify the current RPC definitions rather than replacing photo/consent gates
-- with an earlier snapshot. Abort the transaction on an unexpected definition.
do $migration$
declare
  v_definition text;
  v_base_price_pattern text := 'v_regular_price[[:space:]]+integer[[:space:]]*:=[[:space:]]*(12800|14800)[[:space:]]*;';
  v_launch_pricing text := $old$  perform pg_advisory_xact_lock(hashtext('wan-memory-launch-monitor-12800-20'));
  select count(*)::integer into v_launch_count from public.orders
  where campaign_id in ('launch-monitor-19800-10', 'launch-monitor-16800-10', 'launch-monitor-16800-20', 'launch-monitor-12800-20')
    and status not in ('awaiting_materials', 'cancelled');
  if v_launch_count < 20 then
    v_price := 12800;
    v_campaign := 'launch-monitor-12800-20';
  else
    v_price := v_order.regular_price;
    v_campaign := null;
  end if;$old$;
begin
  v_definition := pg_get_functiondef('public.create_memory_order(jsonb)'::regprocedure);
  if v_definition !~ v_base_price_pattern
     or position('id, user_id, order_number, pet_name' in v_definition) = 0
     or position('v_order_id, v_user_id, v_order_number, trim' in v_definition) = 0 then
    raise exception 'Unexpected create_memory_order definition';
  end if;
  v_definition := regexp_replace(v_definition, v_base_price_pattern,
    'v_plan_id text := coalesce(p_data ->> ''plan_id'', ''memory-film'');' || chr(10) ||
    '  v_regular_price integer := public.memory_plan_price(v_plan_id);');
  v_definition := replace(v_definition, 'id, user_id, order_number, pet_name',
    'id, user_id, order_number, plan_id, pet_name');
  v_definition := replace(v_definition, 'v_order_id, v_user_id, v_order_number, trim',
    'v_order_id, v_user_id, v_order_number, v_plan_id, trim');
  v_definition := replace(v_definition, '''quoted_price'', v_regular_price,',
    '''plan_id'', v_plan_id, ''quoted_price'', v_regular_price,');
  execute v_definition;

  v_definition := pg_get_functiondef('public.submit_memory_order(uuid)'::regprocedure);
  if position(v_launch_pricing in v_definition) > 0 then
    -- Some deployments still use the retired first-20 launch quota. Replace
    -- only future submission pricing; preserve every existing order amount.
    v_definition := replace(v_definition, '  v_launch_count integer;' || chr(10), '');
    v_definition := replace(v_definition, v_launch_pricing, $new$  if v_order.payment_status not in ('pending', 'invoice_sent')
     or v_order.campaign_id = 'complimentary' then
    raise exception 'Only unpaid standard orders can be submitted.';
  end if;
  v_price := public.memory_plan_price(v_order.plan_id);
  v_campaign := null;$new$);
  elsif position('v_price := 12800;' in v_definition) > 0
    and position('v_launch_count' in v_definition) = 0 then
    v_definition := replace(v_definition, 'v_price := 12800;',
      'v_price := public.memory_plan_price(v_order.plan_id);');
  else
    raise exception 'Unexpected submit_memory_order price definition';
  end if;
  if position('      quoted_price = v_price,' in v_definition) = 0 then
    raise exception 'Unexpected submit_memory_order quote assignment';
  end if;
  if position('regular_price = v_price' in v_definition) = 0 then
    v_definition := replace(v_definition, '      quoted_price = v_price,',
      '      quoted_price = v_price,' || chr(10) || '      regular_price = v_price,');
  end if;
  execute v_definition;
end;
$migration$;

-- The updated service terms are required for video-only. A full-plan order
-- retains the previous agreed terms, including older clients still submitting
-- the original full product. AI/photo/privacy versions remain unchanged.
create or replace function public.order_has_current_consents(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    o.consented_at is not null
    and o.external_ai_consent_at is not null
    and o.photo_rights_consented_at is not null
    and (
      o.terms_version = '2026-11-19-video-plan-v1'
      or (o.plan_id = 'memory-film' and o.terms_version = '2026-08-23-revision-2-1-v1')
    )
    and o.privacy_version = '2026-07-27'
    and o.ai_notice_version = '2026-08-23-revision-2-1-v1'
    and o.photo_rights_consent_version = '2026-07-25-photo-people-v2'
    and o.people_policy_version = '2026-07-25-people-policy-v2'
  ), false)
  from public.orders o where o.id = p_order_id;
$$;

do $migration$
declare
  v_definition text;
  v_signature text;
  v_plan_expression text;
  v_old_check text := 'p_data ->> ''terms_version'' is distinct from ''2026-08-23-revision-2-1-v1''';
begin
  foreach v_signature in array array[
    'public.create_memory_order(jsonb)',
    'public.save_memory_order_draft(uuid,jsonb)'
  ] loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if position(v_old_check in v_definition) = 0 then
      raise exception 'Unexpected terms validation in %', v_signature;
    end if;
    v_plan_expression := case when v_signature like '%create_memory_order%'
      then 'v_plan_id'
      else '(select plan_id from public.orders where id = p_order_id)'
    end;
    v_definition := replace(v_definition, v_old_check,
      '(p_data ->> ''terms_version'' is distinct from ''2026-11-19-video-plan-v1'' and (' ||
      v_plan_expression || ' is distinct from ''memory-film'' or p_data ->> ''terms_version'' is distinct from ''2026-08-23-revision-2-1-v1''))');
    v_definition := regexp_replace(v_definition,
      'v_accepted_at, ''2026-08-23-revision-2-1-v1'',',
      'v_accepted_at, p_data ->> ''terms_version'',');
    v_definition := replace(v_definition,
      'terms_version = ''2026-08-23-revision-2-1-v1''',
      'terms_version = p_data ->> ''terms_version''');
    v_definition := replace(v_definition,
      '''terms_version'', ''2026-08-23-revision-2-1-v1''',
      '''terms_version'', p_data ->> ''terms_version''');
    execute v_definition;
  end loop;

  v_definition := pg_get_functiondef('public.accept_order_consents(uuid,text,text,text,text,text,boolean,boolean,boolean)'::regprocedure);
  if position('p_terms_version is distinct from ''2026-08-23-revision-2-1-v1''' in v_definition) = 0 then
    raise exception 'Unexpected accept_order_consents terms validation';
  end if;
  execute replace(v_definition,
    'p_terms_version is distinct from ''2026-08-23-revision-2-1-v1''',
    '(p_terms_version is distinct from ''2026-11-19-video-plan-v1'' and ((select plan_id from public.orders where id = p_order_id) is distinct from ''memory-film'' or p_terms_version is distinct from ''2026-08-23-revision-2-1-v1''))');
end;
$migration$;

create function public.protect_memory_order_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan_id is distinct from old.plan_id then
    if old.status <> 'awaiting_materials' or old.payment_status <> 'pending'
       or old.campaign_id is not null
       or exists (select 1 from public.stripe_checkout_sessions
         where order_id = old.id and status in ('creating', 'open', 'paid', 'refunded')) then
      raise exception 'The plan can only be changed on an unpaid draft before checkout.';
    end if;
    if exists (select 1 from public.line_sticker_deliveries
      where order_id = old.id and (consented_at is not null or status <> 'awaiting_consent')) then
      raise exception 'A plan with LINE production already started cannot be changed.';
    end if;
    new.quoted_price := public.memory_plan_price(new.plan_id);
    new.regular_price := new.quoted_price;
    if new.plan_id = 'video-only' and new.terms_version is distinct from '2026-11-19-video-plan-v1' then
      new.consented_at := null;
      new.terms_version := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger orders_protect_memory_plan
before update of plan_id on public.orders
for each row execute function public.protect_memory_order_plan();

create function public.set_memory_order_plan(p_order_id uuid, p_plan_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_price integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  v_price := public.memory_plan_price(p_plan_id);
  select * into v_order from public.orders
    where id = p_order_id and user_id = auth.uid() for update;
  if not found or v_order.status <> 'awaiting_materials'
     or v_order.payment_status <> 'pending' or v_order.campaign_id is not null then
    raise exception 'Only an unpaid draft can change its plan.';
  end if;
  if v_order.draft_expires_at is not null and v_order.draft_expires_at <= now() then
    raise exception 'The draft has expired.';
  end if;
  if exists (select 1 from public.stripe_checkout_sessions
    where order_id = p_order_id and status in ('creating', 'open', 'paid', 'refunded')) then
    raise exception 'Checkout has already started for this order.';
  end if;
  if v_order.plan_id = p_plan_id then return; end if;
  update public.orders set plan_id = p_plan_id, quoted_price = v_price,
    regular_price = v_price, updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
  values (p_order_id, auth.uid(), 'order_plan_changed', jsonb_build_object(
    'previous_plan_id', v_order.plan_id, 'plan_id', p_plan_id,
    'previous_quoted_price', v_order.quoted_price, 'quoted_price', v_price
  ));
end;
$$;

-- No website/LINE records or website-only assets can be created by bypassing
-- the UI. These table triggers protect all existing RPCs and admin writes.
create function public.enforce_full_plan_benefits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform id from public.orders where id = new.order_id and plan_id = 'memory-film' for update;
  if not found then
    raise exception 'This benefit requires the homepage plan.';
  end if;
  return new;
end;
$$;
create trigger share_links_require_full_plan
before insert or update on public.share_links
for each row execute function public.enforce_full_plan_benefits();
create trigger line_sticker_deliveries_require_full_plan
before insert or update on public.line_sticker_deliveries
for each row execute function public.enforce_full_plan_benefits();
create trigger assets_require_full_plan
before insert or update on public.assets
for each row when (new.category in ('album_photo', 'character_sprite', 'line_sticker_preview', 'line_sticker_package'))
execute function public.enforce_full_plan_benefits();

do $$
begin
  if to_regclass('public.memory_addresses') is not null then
    execute 'create trigger memory_addresses_require_full_plan before insert or update on public.memory_addresses for each row execute function public.enforce_full_plan_benefits()';
  end if;
end;
$$;

create or replace function public.create_line_sticker_delivery_for_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan_id = 'memory-film' then
    insert into public.line_sticker_deliveries(order_id) values (new.id)
    on conflict (order_id) do nothing;
  else
    delete from public.line_sticker_deliveries where order_id = new.id;
  end if;
  return new;
end;
$$;
create trigger orders_update_plan_benefits
after update of plan_id on public.orders
for each row when (old.plan_id is distinct from new.plan_id)
execute function public.create_line_sticker_delivery_for_order();

-- All legacy and current public lookup paths reach one of these helpers.
-- Preserve the existing response shape while filtering video-only orders.
do $migration$
declare
  v_definition text;
  v_signature text;
  v_delivered_predicate text := 'where[[:space:]]+id[[:space:]]*=[[:space:]]*p_order_id[[:space:]]+and[[:space:]]+status[[:space:]]*=[[:space:]]*''delivered''';
  v_delivered_condition text := 'if[[:space:]]+v_order\.status[[:space:]]*<>[[:space:]]*''delivered''[[:space:]]+then';
begin
  v_definition := pg_get_functiondef('public.ensure_public_personal_site(uuid)'::regprocedure);
  if v_definition !~ v_delivered_predicate then
    raise exception 'Unexpected ensure_public_personal_site definition';
  end if;
  execute regexp_replace(v_definition,
    v_delivered_predicate,
    'where id = p_order_id and status = ''delivered'' and plan_id = ''memory-film''');

  foreach v_signature in array array[
    'public.manage_memory_address(uuid,text,text)',
    'public.set_personal_site_met_on(uuid,date)'
  ] loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if v_definition !~ v_delivered_condition then
      raise exception 'Unexpected website management definition: %', v_signature;
    end if;
    execute regexp_replace(v_definition, v_delivered_condition,
      'if v_order.plan_id <> ''memory-film'' then raise exception ''This benefit requires the homepage plan.''; end if;' || chr(10) ||
      '  if v_order.status <> ''delivered'' then');
  end loop;

  v_definition := pg_get_functiondef('public.delivered_memory_for_order(uuid)'::regprocedure);
  if v_definition !~ v_delivered_predicate then
    raise exception 'Unexpected delivered_memory_for_order definition';
  end if;
  execute regexp_replace(v_definition,
    v_delivered_predicate,
    'where id = p_order_id and status = ''delivered'' and plan_id = ''memory-film''');

  v_definition := pg_get_functiondef('public.album_page_for_order(uuid,integer,integer)'::regprocedure);
  if position('where asset.order_id = p_order_id' in v_definition) = 0 then
    raise exception 'Unexpected album_page_for_order definition';
  end if;
  execute replace(v_definition, 'where asset.order_id = p_order_id',
    'where asset.order_id = p_order_id and exists (select 1 from public.orders where id = p_order_id and plan_id = ''memory-film'')');

  v_definition := pg_get_functiondef('public.album_count_for_order(uuid)'::regprocedure);
  if position('where asset.order_id = p_order_id' in v_definition) = 0 then
    raise exception 'Unexpected album_count_for_order definition';
  end if;
  execute replace(v_definition, 'where asset.order_id = p_order_id',
    'where asset.order_id = p_order_id and exists (select 1 from public.orders where id = p_order_id and plan_id = ''memory-film'')');

  v_definition := pg_get_functiondef('public.can_read_shared_asset(text)'::regprocedure);
  if position('orders.id = asset.order_id and orders.status = ''delivered''' in v_definition) = 0 then
    raise exception 'Unexpected can_read_shared_asset definition';
  end if;
  execute replace(v_definition,
    'orders.id = asset.order_id and orders.status = ''delivered''',
    'orders.id = asset.order_id and orders.status = ''delivered'' and orders.plan_id = ''memory-film''');

  v_definition := pg_get_functiondef('public.admin_deliver_order(uuid,uuid,text,text)'::regprocedure);
  if position('  insert into public.deliveries(' in v_definition) = 0 then
    raise exception 'Unexpected admin_deliver_order definition';
  end if;
  execute replace(v_definition, '  insert into public.deliveries(',
    '  if v_order.plan_id = ''video-only'' and not exists (' || chr(10) ||
    '    select 1 from public.assets where id = p_asset_id and order_id = p_order_id' || chr(10) ||
    '      and category = ''final_video'' and mime_type = ''video/mp4''' || chr(10) ||
    '  ) then raise exception ''Video-only delivery requires an MP4 video.''; end if;' || chr(10) ||
    '  insert into public.deliveries(');
end;
$migration$;

revoke all on function public.protect_memory_order_plan() from public, anon, authenticated;
revoke all on function public.enforce_full_plan_benefits() from public, anon, authenticated;
revoke all on function public.create_line_sticker_delivery_for_order() from public, anon, authenticated;
revoke all on function public.ensure_public_personal_site(uuid) from public, anon, authenticated;
revoke all on function public.set_memory_order_plan(uuid, text) from public, anon;
grant execute on function public.set_memory_order_plan(uuid, text) to authenticated;
revoke all on function public.create_memory_order(jsonb) from public, anon;
grant execute on function public.create_memory_order(jsonb) to authenticated;
revoke all on function public.submit_memory_order(uuid) from public, anon;
grant execute on function public.submit_memory_order(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
