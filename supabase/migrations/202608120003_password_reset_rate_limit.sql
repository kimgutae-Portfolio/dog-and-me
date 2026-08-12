-- Custom branded recovery emails use admin.generateLink, which does not rely
-- on the browser-facing email sender's normal cooldown. Preserve a server-side
-- two-minute cooldown per account without revealing whether an address exists.

create table if not exists public.password_reset_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null default now(),
  request_count integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.password_reset_requests enable row level security;

create or replace function public.password_reset_request_allowed(p_email text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_last_sent_at timestamptz;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  -- Unknown address: send nothing and let the route return the same response.
  if v_user_id is null then return false; end if;

  select last_sent_at into v_last_sent_at
  from public.password_reset_requests
  where user_id = v_user_id
  for update;

  if found and v_last_sent_at > now() - interval '2 minutes' then
    return false;
  end if;

  insert into public.password_reset_requests(user_id, last_sent_at, request_count, updated_at)
  values (v_user_id, now(), 1, now())
  on conflict (user_id) do update
    set last_sent_at = excluded.last_sent_at,
        request_count = public.password_reset_requests.request_count + 1,
        updated_at = now();

  return true;
exception when others then
  -- Fail closed: a rate-limit fault must not allow unlimited reset messages.
  return false;
end;
$$;

revoke all on table public.password_reset_requests from public, anon, authenticated;
revoke all on function public.password_reset_request_allowed(text) from public, anon, authenticated;
grant execute on function public.password_reset_request_allowed(text) to service_role;
