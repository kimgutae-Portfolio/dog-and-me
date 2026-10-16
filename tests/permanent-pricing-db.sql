\set ON_ERROR_STOP on
-- Run from repository root against a NEW disposable PostgreSQL database only.
\i tests/fixtures/permanent-pricing-schema.sql
\i supabase/migrations/202608050002_launch_price_19800.sql
\i supabase/migrations/202608070001_fix_create_memory_order_consent_version.sql
\i supabase/migrations/202608170004_launch_price_16800.sql
\i supabase/migrations/202608250004_launch_monitor_limit_twenty.sql
\i supabase/migrations/202608290001_launch_price_12800.sql

-- The later consent migrations patch several other RPCs as well. Apply their
-- final version to this focused fixture without installing unrelated features.
do $$
begin
  execute replace(
    pg_get_functiondef('public.create_memory_order(jsonb)'::regprocedure),
    '2026-08-02-storybook-v1', '2026-08-23-revision-2-1-v1'
  );
end;
$$;

insert into orders(id, quoted_price, regular_price, status, payment_status)
values ('00000000-0000-0000-0000-000000000001',14800,14800,'concept_selected','invoice_sent');
insert into stripe_checkout_sessions(order_id,status)
values ('00000000-0000-0000-0000-000000000001','open');

-- This deliberately fails and rolls the WHOLE migration back: an already sent
-- higher-price checkout cannot be changed underneath Stripe amount validation.
\set ON_ERROR_STOP off
\i supabase/migrations/202610150001_permanent_memory_film_price.sql
\set ON_ERROR_STOP on
do $$
begin
  if (select regular_price from public.get_memory_film_pricing()) <> 14800
     or (select quoted_price from orders where id='00000000-0000-0000-0000-000000000001') <> 14800 then
    raise exception 'Stripe preflight did not roll back atomically';
  end if;
  if position('v_launch_count' in pg_get_functiondef('public.submit_memory_order(uuid)'::regprocedure)) = 0 then
    raise exception 'Submit function changed despite checkout blocker';
  end if;
end;
$$;

-- Local-only stand-in for an operator confirming Stripe expiry before release.
update stripe_checkout_sessions set status='expired';
insert into orders(id,quoted_price,regular_price,status,payment_status,campaign_id) values
 ('00000000-0000-0000-0000-000000000002',19800,24800,'delivered','paid','launch-monitor-19800-10'),
 ('00000000-0000-0000-0000-000000000003',14800,14800,'concept_selected','refunded',null),
 ('00000000-0000-0000-0000-000000000004',0,14800,'production','paid','complimentary'),
 ('00000000-0000-0000-0000-000000000005',14800,14800,'cancelled','pending',null),
 ('00000000-0000-0000-0000-000000000006',14800,14800,'awaiting_materials','pending',null),
 ('00000000-0000-0000-0000-000000000007',12800,14800,'materials_submitted','pending','launch-monitor-12800-20'),
 ('00000000-0000-0000-0000-000000000008',12000,14800,'concept_selected','invoice_sent',null),
 ('00000000-0000-0000-0000-000000000009',18000,18000,'concept_selected','invoice_sent','custom-agreement');
create table test_preserved_prices as
select id,quoted_price,regular_price,campaign_id from orders
where id in (
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005',
 '00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000009'
);
\i supabase/migrations/202610150001_permanent_memory_film_price.sql

do $$
declare v_order_id uuid; v_other_order_id uuid; v_result record; v_definition text;
begin
  if exists (
    select 1 from test_preserved_prices expected
    join orders actual on actual.id=expected.id
    where (actual.quoted_price,actual.regular_price,actual.campaign_id)
      is distinct from (expected.quoted_price,expected.regular_price,expected.campaign_id)
  ) then raise exception 'Historical, complimentary or custom amount changed'; end if;
  if exists(select 1 from orders where id in (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000007'
  ) and (quoted_price<>12800 or regular_price<>12800 or campaign_id is not null)) then
    raise exception 'Unpaid standard quote was not normalized';
  end if;
  if (select count(*) from order_events where event_type='standard_price_updated') <> 3 then
    raise exception 'Repricing audit events missing';
  end if;
  if not has_function_privilege('anon','public.get_memory_film_pricing()','execute')
     or has_function_privilege('anon','public.create_memory_order(jsonb)','execute')
     or has_function_privilege('anon','public.submit_memory_order(uuid)','execute')
     or not has_function_privilege('authenticated','public.submit_memory_order(uuid)','execute') then
    raise exception 'RPC access privileges changed';
  end if;
  v_definition := pg_get_functiondef('public.submit_memory_order(uuid)'::regprocedure);
  if position('v_launch_count' in v_definition)>0 or position('launch-monitor' in v_definition)>0
     or position('pg_advisory_xact_lock' in v_definition)>0 then
    raise exception 'Launch quota remains in submit RPC';
  end if;

  -- More than twenty legacy paid orders must not affect today's standard price.
  insert into orders(quoted_price,status,payment_status,campaign_id)
  select 12800,'production','paid','launch-monitor-12800-20' from generate_series(1,25);
  select * into v_result from public.get_memory_film_pricing();
  if (v_result.current_price,v_result.regular_price,v_result.launch_limit,
      v_result.launch_used,v_result.launch_remaining,v_result.campaign_active)
     is distinct from (12800,12800,0,0,0,false) then
    raise exception 'Standard price still depends on launch count';
  end if;

  begin
    perform public.create_memory_order(public.test_pricing_payload());
    raise exception 'Unauthenticated creation accepted';
  exception when raise_exception then
    if sqlerrm <> 'authentication required' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
  begin
    perform public.create_memory_order(public.test_pricing_payload() || '{"consent_accepted":false}');
    raise exception 'Missing terms consent accepted';
  exception when raise_exception then
    if sqlerrm <> 'terms and privacy consent required' then raise; end if;
  end;
  begin
    perform public.create_memory_order(public.test_pricing_payload() || '{"terms_version":"stale"}');
    raise exception 'Stale consent accepted';
  exception when raise_exception then
    if sqlerrm <> 'current policy versions required' then raise; end if;
  end;
  begin
    perform public.create_memory_order(public.test_pricing_payload() || '{"photo_rights_accepted":false}');
    raise exception 'Missing photo rights consent accepted';
  exception when raise_exception then
    if sqlerrm <> 'photo rights consent required' then raise; end if;
  end;
  select order_id into v_order_id from public.create_memory_order(public.test_pricing_payload());
  if not exists(select 1 from orders where id=v_order_id and quoted_price=12800
     and regular_price=12800 and campaign_id is null
     and terms_version='2026-08-23-revision-2-1-v1') then
    raise exception 'New quote/consent version incorrect';
  end if;
  begin
    perform public.submit_memory_order(v_order_id);
    raise exception 'Order without five stories accepted';
  exception when raise_exception then
    if sqlerrm <> '物語は5項目入力してください。' then raise; end if;
  end;
  perform public.test_add_five_stories(v_order_id);
  perform set_config('test.current_consents','false',false);
  begin
    perform public.submit_memory_order(v_order_id);
    raise exception 'Missing current consent accepted';
  exception when raise_exception then
    if sqlerrm <> '必要な同意項目をご確認ください。' then raise; end if;
  end;
  perform set_config('test.current_consents','true',false);
  update orders set ai_reconstruction_acknowledged=false where id=v_order_id;
  begin
    perform public.submit_memory_order(v_order_id);
    raise exception 'Missing reconstruction acknowledgement accepted';
  exception when raise_exception then
    if sqlerrm <> '絵本としての再構成についてご確認ください。' then raise; end if;
  end;
  update orders set ai_reconstruction_acknowledged=true where id=v_order_id;
  update assets set memory_photo_sort_order=null where order_id=v_order_id;
  begin
    perform public.submit_memory_order(v_order_id);
    raise exception 'Story without source photo accepted';
  exception when raise_exception then
    if sqlerrm <> '各物語に写真を1〜3枚選んでください。' then raise; end if;
  end;
  update assets set memory_photo_sort_order=1 where order_id=v_order_id;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
  begin
    perform public.submit_memory_order(v_order_id);
    raise exception 'Cross-account submit accepted';
  exception when raise_exception then
    if sqlerrm <> 'ご相談を送信できる状態ではありません。' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
  -- A draft left open before the price change gets the fixed price on submit.
  update orders set quoted_price=14800,regular_price=14800 where id=v_order_id;
  perform public.submit_memory_order(v_order_id);
  if not exists(select 1 from orders where id=v_order_id and status='materials_submitted'
     and quoted_price=12800 and regular_price=12800 and campaign_id is null
     and photo_analysis_status='pending_operator_review') then
    raise exception 'Submission fixed price or review state incorrect';
  end if;
  select order_id into v_other_order_id from public.create_memory_order(public.test_pricing_payload());
  perform public.test_add_five_stories(v_other_order_id);
  update orders set payment_status='paid',quoted_price=0,campaign_id='complimentary'
  where id=v_other_order_id;
  begin
    perform public.submit_memory_order(v_other_order_id);
    raise exception 'Paid complimentary draft repriced';
  exception when raise_exception then
    if sqlerrm <> 'Only unpaid standard orders can be submitted.' then raise; end if;
  end;
  raise notice 'PASS: permanent pricing after 25 orders, create/submit, consent/ownership/photo gates, historical preservation, Stripe preflight rollback, repricing audit and RPC grants';
end;
$$;
