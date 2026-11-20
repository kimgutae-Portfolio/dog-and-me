\set ON_ERROR_STOP on
-- Run from the repository root against a NEW disposable PostgreSQL database.
-- Also run with -v video_plan_legacy_pricing=true to cover the deployed pricing
-- state that has not installed 202610150001_permanent_memory_film_price.sql.
\i tests/fixtures/video-plan-schema.sql

insert into orders(id, quoted_price, regular_price, status, payment_status, campaign_id)
values
  ('00000000-0000-0000-0000-000000000001', 19800, 24800, 'production', 'paid', 'legacy'),
  ('00000000-0000-0000-0000-000000000002', 18000, 18000, 'concept_selected', 'invoice_sent', 'custom-agreement'),
  ('00000000-0000-0000-0000-000000000003', 14800, 14800, 'awaiting_materials', 'pending', null),
  ('00000000-0000-0000-0000-000000000004', 0, 14800, 'production', 'paid', 'complimentary'),
  ('00000000-0000-0000-0000-000000000005', 20000, 20000, 'delivered', 'paid', 'custom-paid-agreement');
-- Exhaust the former twenty-order quota before applying the new migration.
insert into orders(quoted_price, regular_price, status, payment_status, campaign_id)
select 12800, 14800, 'production', 'paid', 'launch-monitor-12800-20'
from generate_series(1, 25);
create table test_existing_order_prices as
select id, quoted_price, regular_price, campaign_id, status, payment_status from orders;
\if :video_plan_legacy_pricing
do $$
declare v_pricing record;
begin
  select * into v_pricing from public.get_memory_film_pricing();
  if (v_pricing.current_price, v_pricing.regular_price, v_pricing.launch_limit,
      v_pricing.launch_used, v_pricing.launch_remaining, v_pricing.campaign_active)
     is distinct from (14800, 14800, 20, 25, 0, false) then
    raise exception 'Legacy fixture did not retain the exhausted launch quota';
  end if;
end;
$$;
\endif
\i supabase/migrations/202611190001_video_only_plan.sql

create function public.test_expect_error(p_sql text, p_expected text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_expected then return; end if;
    raise exception 'Unexpected error for %: %', p_sql, sqlerrm;
  end;
  raise exception 'Expected an error for %', p_sql;
end;
$$;

do $$
declare
  v_full uuid;
  v_video uuid;
  v_draft uuid;
  v_final uuid;
  v_other uuid;
  v_order_count integer;
  v_initial_address text;
  v_pricing record;
  v_payload jsonb := public.test_pricing_payload() || '{"terms_version":"2026-11-19-video-plan-v1"}';
begin
  if exists (
    select 1 from test_existing_order_prices expected
    left join orders actual on actual.id = expected.id
    where actual.id is null or actual.plan_id <> 'memory-film'
      or (actual.quoted_price, actual.regular_price, actual.campaign_id, actual.status, actual.payment_status)
         is distinct from
         (expected.quoted_price, expected.regular_price, expected.campaign_id, expected.status, expected.payment_status)
  ) then
    raise exception 'Existing paid, custom, complimentary or pending contract changed';
  end if;
  select * into v_pricing from public.get_memory_film_pricing();
  if (v_pricing.current_price, v_pricing.regular_price, v_pricing.launch_limit,
      v_pricing.launch_used, v_pricing.launch_remaining, v_pricing.campaign_active)
     is distinct from (12800, 12800, 0, 0, 0, false) then
    raise exception 'Full-plan pricing RPC still depends on the launch quota';
  end if;
  if has_function_privilege('anon','public.set_memory_order_plan(uuid,text)','execute')
     or not has_function_privilege('authenticated','public.set_memory_order_plan(uuid,text)','execute') then
    raise exception 'Plan RPC grants incorrect';
  end if;
  perform public.test_expect_error(
    'select public.set_memory_order_plan(gen_random_uuid(),''video-only'')', 'authentication required');
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
  select order_id into v_full from public.create_memory_order(public.test_pricing_payload());
  select order_id into v_video from public.create_memory_order(v_payload || '{"plan_id":"video-only","quoted_price":1,"price":1}');
  if not exists(select 1 from orders where id=v_full and quoted_price=12800 and regular_price=12800
    and campaign_id is null and plan_id='memory-film'
    and terms_version='2026-08-23-revision-2-1-v1')
    or not public.order_has_current_consents(v_full) then raise exception 'Legacy full plan unsupported'; end if;
  if not exists(select 1 from orders where id=v_video and quoted_price=7800 and regular_price=7800
    and plan_id='video-only' and terms_version='2026-11-19-video-plan-v1')
    or not public.order_has_current_consents(v_video) then raise exception 'Video quote or consent incorrect'; end if;
  if exists(select 1 from line_sticker_deliveries where order_id=v_video)
    or not exists(select 1 from line_sticker_deliveries where order_id=v_full) then
    raise exception 'LINE automatic benefit mismatch';
  end if;
  select count(*) into v_order_count from orders;
  perform public.test_expect_error(
    format('select public.create_memory_order(%L::jsonb)', v_payload || '{"plan_id":"free"}'), 'invalid memory plan');
  perform public.test_expect_error(
    format('select public.create_memory_order(%L::jsonb)', public.test_pricing_payload() || '{"plan_id":"video-only"}'),
    'current policy versions required');
  if (select count(*) from orders) <> v_order_count then raise exception 'Invalid request left a partial order'; end if;

  select order_id into v_other from public.create_memory_order(v_payload);
  perform public.save_memory_order_draft(v_other,v_payload);
  if not exists(select 1 from orders where id=v_other and quoted_price=12800
    and terms_version='2026-11-19-video-plan-v1' and ai_notice_version='2026-08-23-revision-2-1-v1')
    or not public.order_has_current_consents(v_other) then raise exception 'Full new terms changed AI consent'; end if;

  perform public.save_memory_order_draft(v_video, v_payload);
  perform public.accept_order_consents(v_video,'2026-11-19-video-plan-v1','2026-07-27',
    '2026-08-23-revision-2-1-v1','2026-07-25-photo-people-v2','2026-07-25-people-policy-v2',true,true,true);
  perform public.test_expect_error(format('select public.accept_order_consents(%L::uuid,%L,%L,%L,%L,%L,true,true,true)',
    v_video,'2026-08-23-revision-2-1-v1','2026-07-27','2026-08-23-revision-2-1-v1',
    '2026-07-25-photo-people-v2','2026-07-25-people-policy-v2'), 'current policy versions required');

  select order_id into v_draft from public.create_memory_order(public.test_pricing_payload());
  perform public.set_memory_order_plan(v_draft,'video-only');
  if (select quoted_price<>7800 or terms_version is not null or consented_at is not null from orders where id=v_draft)
    or exists(select 1 from line_sticker_deliveries where order_id=v_draft)
    or public.order_has_current_consents(v_draft) then raise exception 'Switch failed to reprice or reset old terms'; end if;
  perform public.set_memory_order_plan(v_draft,'memory-film');
  if not exists(select 1 from line_sticker_deliveries where order_id=v_draft) then raise exception 'Full benefit not restored'; end if;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
  perform public.test_expect_error(format('select public.set_memory_order_plan(%L::uuid,''video-only'')',v_draft),
    'Only an unpaid draft can change its plan.');
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
  insert into stripe_checkout_sessions(order_id,status) values (v_draft,'open');
  perform public.test_expect_error(format('select public.set_memory_order_plan(%L::uuid,''video-only'')',v_draft),
    'Checkout has already started for this order.');

  perform public.test_add_five_stories(v_full);
  perform public.submit_memory_order(v_full);
  if not exists(select 1 from orders where id=v_full and status='materials_submitted'
    and quoted_price=12800 and regular_price=12800 and campaign_id is null) then
    raise exception 'Full submission retained launch pricing after 25 existing orders';
  end if;
  perform public.test_add_five_stories(v_video);
  perform public.submit_memory_order(v_video);
  if not exists(select 1 from orders where id=v_video and status='materials_submitted'
    and quoted_price=7800 and regular_price=7800 and campaign_id is null)
    then raise exception 'Video submitted at wrong price'; end if;
  perform public.test_expect_error(format('select public.set_memory_order_plan(%L::uuid,''memory-film'')',v_video),
    'Only an unpaid draft can change its plan.');
  perform public.test_expect_error(format('update public.orders set plan_id=''memory-film'' where id=%L::uuid',v_video),
    'The plan can only be changed on an unpaid draft before checkout.');

  perform public.test_expect_error(format('select public.accept_line_sticker_consent(%L::uuid,''2026-08-27-line-sticker-v1'',true)',v_video),
    'This benefit requires the homepage plan.');
  perform public.test_expect_error(format('select public.manage_memory_share(%L::uuid,''get'')',v_video),
    'This benefit requires the homepage plan.');
  perform public.test_expect_error(format('insert into public.assets(order_id,category) values (%L::uuid,''character_sprite'')',v_video),
    'This benefit requires the homepage plan.');

  insert into assets(order_id,category,mime_type,storage_path) values(v_video,'final_video','video/mp4','video-only.mp4') returning id into v_final;
  perform public.test_expect_error(format('select public.admin_deliver_order(%L::uuid,%L::uuid,''Test'',null)',v_video,v_final),
    'admin required');
  perform set_config('test.is_admin','true',false);
  perform public.test_expect_error(format('select public.admin_deliver_order(%L::uuid,%L::uuid,''Test'',null)',v_video,v_final),
    'payment must be confirmed before delivery');
  update orders set payment_status='paid',status='quality_check' where id=v_video;
  perform public.test_expect_error(format('select public.admin_deliver_order(%L::uuid,%L::uuid,''Test'',null)',v_video,v_final),
    'customer approval required before delivery');
  update orders set customer_approved_at=now(),customer_approved_review_asset_id=v_final where id=v_video;
  insert into revision_requests(order_id,status) values(v_video,'open');
  perform public.test_expect_error(format('select public.admin_deliver_order(%L::uuid,%L::uuid,''Test'',null)',v_video,v_final),
    'open revision must be resolved before delivery');
  update revision_requests set status='resolved' where order_id=v_video;
  update assets set mime_type='video/webm' where id=v_final;
  perform public.test_expect_error(format('select public.admin_deliver_order(%L::uuid,%L::uuid,''Test'',null)',v_video,v_final),
    'Video-only delivery requires an MP4 video.');
  update assets set mime_type='video/mp4' where id=v_final;
  perform public.admin_deliver_order(v_video,v_final,'Test',null);
  if not exists(select 1 from deliveries where order_id=v_video and final_asset_id=v_final)
    or exists(select 1 from share_links where order_id=v_video)
    or public.delivered_memory_for_order(v_video) is not null
    or public.album_count_for_order(v_video)<>0
    or public.album_page_for_order(v_video,0,30)<>'[]'::jsonb
    or public.can_read_shared_asset('video-only.mp4') then
    raise exception 'Video delivery exposed website benefits';
  end if;
  perform public.test_expect_error(format('select public.manage_memory_address(%L::uuid,''get'',null)',v_video),
    'This benefit requires the homepage plan.');
  perform public.test_expect_error(format('select public.register_lifetime_album_photo(%L::uuid,%L,''photo.jpg'',''image/jpeg'',100)',
    v_video,'10000000-0000-0000-0000-000000000001/'||v_video::text||'/album/test.jpg'),
    'This benefit requires the homepage plan.');

  insert into assets(order_id,category,mime_type,storage_path) values(v_full,'final_video','video/mp4','full.mp4') returning id into v_other;
  update orders set payment_status='paid',status='quality_check',customer_approved_at=now(),customer_approved_review_asset_id=v_other where id=v_full;
  perform public.admin_deliver_order(v_full,v_other,'Full',null);
  if not exists(select 1 from share_links where order_id=v_full)
    or public.delivered_memory_for_order(v_full) is null
    or not public.can_read_shared_asset('full.mp4') then raise exception 'Full delivery benefits regressed'; end if;
  select initial_slug into v_initial_address from share_links where order_id=v_full;
  if v_initial_address is null or v_initial_address !~ '^[a-f0-9]{6}$' then
    raise exception 'Initial address allocation regressed';
  end if;
  perform public.manage_memory_address(v_full,'set','moka-birthday');
  perform public.ensure_public_personal_site(v_full);
  if not exists(select 1 from share_links where order_id=v_full and custom_slug='moka-birthday')
    or (select initial_slug from share_links where order_id=v_full) <> v_initial_address
    or public.get_shared_memory_by_address('moka-birthday') is null
    or public.get_shared_memory_by_address(v_initial_address) is null then
    raise exception 'Full address allocation or stable address regressed';
  end if;
  raise notice 'PASS: plan prices, legacy/custom preservation, invalid input, terms, ownership, checkout locks, immutability, LINE/site/asset gating, paid approval and MP4 delivery.';
end;
$$;

set role authenticated;
do $$
declare v_result record;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
  select * into v_result from public.create_memory_order(public.test_pricing_payload() ||
    '{"terms_version":"2026-11-19-video-plan-v1","plan_id":"video-only"}');
  if v_result.quoted_price <> 7800 then raise exception 'Authenticated plan creation failed'; end if;
  perform public.set_memory_order_plan(v_result.order_id,'memory-film');
  begin
    perform public.memory_plan_price('video-only');
    raise exception 'Private price helper exposed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: actual authenticated role can create/change an owned draft, private helper remains private.';
end;
$$;
reset role;
