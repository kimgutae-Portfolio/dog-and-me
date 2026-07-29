-- Login attempt lockout and a working security audit log.
--
-- WHY THIS LIVES IN A SUPABASE AUTH HOOK, NOT IN THE APP
-- ------------------------------------------------------
-- The browser calls Supabase Auth directly with the publishable (anon) key,
-- which is a public value. A counter implemented in app/auth/AuthPanel.tsx
-- would therefore be trivially bypassed by calling the Supabase Auth REST API
-- straight from curl. The Password Verification Hook below is invoked by
-- Supabase itself on every password check, so it cannot be routed around.
--
-- ⚠️ THIS MIGRATION ALONE DOES NOTHING.
-- The hook must additionally be enabled in the Supabase dashboard:
--   Authentication → Hooks → "Password Verification Attempt"
--   → select public.hook_password_verification_attempt
-- Without that, the function exists but is never called.

-- ---------------------------------------------------------------------------
-- Audit log: make the existing security_events table usable
-- ---------------------------------------------------------------------------

create index if not exists security_events_created_at_idx
  on public.security_events(created_at desc);
create index if not exists security_events_type_created_at_idx
  on public.security_events(event_type, created_at desc);

-- Internal writer. security_events grants no INSERT to anyone, so every writer
-- must be security definer (the existing precedent is protect_profile_role()).
create or replace function public.record_security_event(
  p_event_type text,
  p_target_user_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.security_events(actor_id, target_user_id, event_type, payload)
  values (
    auth.uid(),
    -- The FK points at profiles; a login for an address with no profile row
    -- must still be recorded, so fall back to NULL and keep detail in payload.
    (select p.id from public.profiles p where p.id = p_target_user_id),
    p_event_type,
    coalesce(p_payload, '{}'::jsonb)
  );
exception when others then
  -- Audit logging must never break the operation it is observing.
  null;
end;
$$;

revoke all on function public.record_security_event(text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lockout state
-- ---------------------------------------------------------------------------

create table if not exists public.login_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_count integer not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

drop policy if exists login_attempts_admin_select on public.login_attempts;
create policy login_attempts_admin_select on public.login_attempts for select to authenticated
using (public.is_admin());

grant select on public.login_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- Password Verification Hook
-- ---------------------------------------------------------------------------

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_valid boolean;
  v_row public.login_attempts%rowtype;
  v_max_attempts constant integer := 10;
  v_lock_duration constant interval := interval '30 minutes';
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_valid := coalesce((event -> 'valid')::boolean, false);

  if v_user_id is null then
    return jsonb_build_object('decision', 'continue');
  end if;

  select * into v_row from public.login_attempts where user_id = v_user_id for update;

  -- Still inside an active lock: refuse even a correct password.
  if found and v_row.locked_until is not null and v_row.locked_until > now() then
    perform public.record_security_event(
      'login_rejected_locked', v_user_id,
      jsonb_build_object('locked_until', v_row.locked_until)
    );
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'アカウントを一時的にロックしています。しばらく時間をおいてからお試しください。'
    );
  end if;

  if v_valid then
    -- Successful sign-in clears the counter and any expired lock.
    insert into public.login_attempts(user_id, failed_count, locked_until, updated_at)
    values (v_user_id, 0, null, now())
    on conflict (user_id) do update
      set failed_count = 0, locked_until = null, updated_at = now();

    perform public.record_security_event('login_succeeded', v_user_id, '{}'::jsonb);
    return jsonb_build_object('decision', 'continue');
  end if;

  -- Failure: increment, and lock once the threshold is reached.
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
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'アカウントを一時的にロックしました。しばらく時間をおいてからお試しください。'
    );
  end if;

  perform public.record_security_event(
    'login_failed', v_user_id,
    jsonb_build_object('failed_count', v_row.failed_count)
  );
  return jsonb_build_object('decision', 'continue');

exception when others then
  -- 🔴 FAIL OPEN. If this hook raises, Supabase treats it as a failure and NO
  -- ONE CAN SIGN IN — customers included. Availability wins over the lockout:
  -- a bug here must degrade to "no lockout", never to "no login".
  return jsonb_build_object('decision', 'continue');
end;
$$;

-- The hook is invoked by the auth service, never by application roles.
revoke all on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
grant all on table public.login_attempts to supabase_auth_admin;
grant execute on function public.record_security_event(text, uuid, jsonb) to supabase_auth_admin;
