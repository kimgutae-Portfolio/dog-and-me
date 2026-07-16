alter table public.profiles
add column if not exists primary_pet_name text;

update public.profiles as profile
set primary_pet_name = nullif(trim(auth_user.raw_user_meta_data ->> 'pet_name'), '')
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.primary_pet_name is null
  and nullif(trim(auth_user.raw_user_meta_data ->> 'pet_name'), '') is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, primary_pet_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'pet_name'), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, profiles.full_name),
      primary_pet_name = coalesce(excluded.primary_pet_name, profiles.primary_pet_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();
