-- Account lockout, reworked for the Free plan.
--
-- 202607290001 implemented this as a Supabase Password Verification Hook, which
-- is the ideal place: the auth service calls it on every password check, so it
-- cannot be bypassed. That hook turned out to require a Team/Enterprise plan and
-- is unavailable here, so the function is dropped and the same login_attempts
-- table is now driven from the server route /api/auth/login instead.
--
-- ⚠️ RESULTING SECURITY PROPERTY — DOCUMENT HONESTLY, DO NOT OVERSTATE
-- The lockout now applies to sign-ins that go through the application. Someone
-- who calls the Supabase Auth REST API directly with the publishable key does
-- not hit it. That path is instead covered by Supabase's own IP rate limiting
-- (token bucket, 30 requests/hour by default, tunable under
-- Authentication → Rate Limits), which is enforced by the platform.
-- See docs/SECURITY.md.
--
-- These functions are granted to service_role ONLY. If anon could reach
-- login_record_failure, anyone could lock any known address out of their own
-- account with ten calls.

drop function if exists public.hook_password_verification_attempt(jsonb);

-- Resolve an address to a user without leaking whether it exists: callers get
-- the same shape either way.
create or replace function public.login_lock_status(p_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_locked_until timestamptz;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user_id is null then
    return jsonb_build_object('locked', false);
  end if;

  select locked_until into v_locked_until from public.login_attempts where user_id = v_user_id;
  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object('locked', true, 'locked_until', v_locked_until);
  end if;
  return jsonb_build_object('locked', false);
exception when others then
  -- Availability first: a fault here must not stop people signing in.
  return jsonb_build_object('locked', false);
end;
$$;

create or replace function public.login_record_failure(p_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.login_attempts%rowtype;
  v_max_attempts constant integer := 10;
  v_lock_duration constant interval := interval '30 minutes';
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user_id is null then
    -- Unknown address: record nothing, reveal nothing.
    return jsonb_build_object('locked', false);
  end if;

  insert into public.login_attempts(user_id, failed_count, last_failed_at, updated_at)
  values (v_user_id, 1, now(), now())
  on conflict (user_id) do update
    set failed_count = public.login_attempts.failed_count + 1,
        last_failed_at = now(),
        locked_until = case
          when public.login_attempts.failed_count + 1 >= v_max_attempts then now() + v_lock_duration
          else public.login_attempts.locked_until
        end,
        updated_at = now()
  returning * into v_row;

  if v_row.failed_count >= v_max_attempts then
    perform public.record_security_event(
      'login_locked', v_user_id,
      jsonb_build_object('failed_count', v_row.failed_count, 'locked_until', v_row.locked_until)
    );
    return jsonb_build_object('locked', true, 'locked_until', v_row.locked_until);
  end if;

  perform public.record_security_event(
    'login_failed', v_user_id,
    jsonb_build_object('failed_count', v_row.failed_count)
  );
  return jsonb_build_object('locked', false, 'failed_count', v_row.failed_count);
exception when others then
  return jsonb_build_object('locked', false);
end;
$$;

create or replace function public.login_record_success(p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user_id is null then return; end if;

  insert into public.login_attempts(user_id, failed_count, locked_until, updated_at)
  values (v_user_id, 0, null, now())
  on conflict (user_id) do update
    set failed_count = 0, locked_until = null, updated_at = now();

  perform public.record_security_event('login_succeeded', v_user_id, '{}'::jsonb);
exception when others then
  null;
end;
$$;

revoke all on function public.login_lock_status(text) from public, anon, authenticated;
revoke all on function public.login_record_failure(text) from public, anon, authenticated;
revoke all on function public.login_record_success(text) from public, anon, authenticated;
grant execute on function public.login_lock_status(text) to service_role;
grant execute on function public.login_record_failure(text) to service_role;
grant execute on function public.login_record_success(text) to service_role;
