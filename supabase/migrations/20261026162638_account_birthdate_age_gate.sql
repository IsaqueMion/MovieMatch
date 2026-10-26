begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- This table is readable only by its owner; public profiles never expose birthdates.
alter table public.users add column birthdate date;
alter table public.users add constraint users_birthdate_valid check (birthdate is null or (birthdate >= date '1900-01-01' and birthdate <= (now() at time zone 'UTC')::date));
grant select (birthdate) on public.users to authenticated;

create or replace function private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dob date;
begin
  -- Metadata is signup input only, never a mutable authorization claim.
  if not coalesce(new.is_anonymous, false) and new.raw_user_meta_data ? 'birthdate' then
    if (new.raw_user_meta_data->>'birthdate') is null or (new.raw_user_meta_data->>'birthdate') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise invalid_parameter_value using message = 'Invalid birthdate';
    end if;
    dob := (new.raw_user_meta_data->>'birthdate')::date;
    if dob < date '1900-01-01' or dob > (now() at time zone 'UTC')::date then
      raise invalid_parameter_value using message = 'Invalid birthdate';
    end if;
  end if;
  insert into public.users (id, birthdate, is_adult)
  values (new.id, dob, coalesce(dob <= ((now() at time zone 'UTC')::date - interval '18 years')::date, false))
  on conflict (id) do nothing;
  return new;
end;
$$;

create function private.set_birthdate(p_birthdate date) returns date
language plpgsql security definer set search_path = '' as $$
declare existing date;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_birthdate is null or p_birthdate < date '1900-01-01' or p_birthdate > (now() at time zone 'UTC')::date then
    raise invalid_parameter_value using message = 'Invalid birthdate';
  end if;
  select birthdate into existing from public.users where id = auth.uid() for update;
  if not found then raise insufficient_privilege; end if;
  if existing is not null and existing <> p_birthdate then
    raise insufficient_privilege using message = 'Birthdate already recorded';
  end if;
  update public.users set birthdate = p_birthdate,
    is_adult = p_birthdate <= ((now() at time zone 'UTC')::date - interval '18 years')::date
    where id = auth.uid();
  return p_birthdate;
end;
$$;
revoke all on function private.set_birthdate(date) from public, anon;
grant execute on function private.set_birthdate(date) to authenticated;
create function public.set_birthdate(p_birthdate date) returns date
language sql security invoker set search_path = '' as $$ select private.set_birthdate(p_birthdate); $$;
revoke all on function public.set_birthdate(date) from public, anon;
grant execute on function public.set_birthdate(date) to authenticated;

create function public.adult_content_allowed() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((select case when birthdate is not null
    then birthdate <= ((now() at time zone 'UTC')::date - interval '18 years')::date
    else is_adult end from public.users where id = auth.uid()), false);
$$;
revoke all on function public.adult_content_allowed() from public, anon;
grant execute on function public.adult_content_allowed() to authenticated;

-- Older clients may still write this flag, but cannot override a recorded birthday.
create function private.guard_adult_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.birthdate is not null then
    new.is_adult := new.birthdate <= ((now() at time zone 'UTC')::date - interval '18 years')::date;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_adult_status() from public, anon, authenticated;
create trigger guard_adult_status before update of is_adult on public.users
for each row execute function private.guard_adult_status();
commit;
