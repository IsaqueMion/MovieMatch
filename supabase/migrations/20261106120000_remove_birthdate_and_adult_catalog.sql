begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Older app versions may still send signup metadata, so discard it at Auth's boundary.
create or replace function private.strip_birthdate_metadata() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'birthdate';
  return new;
end;
$$;
revoke all on function private.strip_birthdate_metadata() from public, anon, authenticated;
drop trigger if exists strip_birthdate_auth_metadata on auth.users;
create trigger strip_birthdate_auth_metadata before insert or update of raw_user_meta_data on auth.users
for each row execute function private.strip_birthdate_metadata();

update auth.users
set raw_user_meta_data = raw_user_meta_data - 'birthdate'
where raw_user_meta_data ? 'birthdate';

-- Keep nullable legacy columns/RPCs temporarily so cached clients still load.
update public.users
set birthdate = null, is_adult = false
where birthdate is not null or is_adult is true;
update public.session_filters set include_adult = false where include_adult is true;
revoke update (is_adult) on public.users from authenticated;
drop trigger if exists guard_adult_status on public.users;
drop function if exists private.guard_adult_status();

create or replace function public.set_birthdate(p_birthdate date) returns date
language sql security invoker set search_path = '' as $$ select null::date; $$;
revoke all on function public.set_birthdate(date) from public, anon;
grant execute on function public.set_birthdate(date) to authenticated;

create or replace function public.adult_content_allowed() returns boolean
language sql stable security invoker set search_path = '' as $$ select false; $$;
revoke all on function public.adult_content_allowed() from public, anon;
grant execute on function public.adult_content_allowed() to authenticated;

do $$
begin
  if to_regprocedure('private.set_birthdate(date)') is not null then
    execute 'revoke all on function private.set_birthdate(date) from public, anon, authenticated';
  end if;
end;
$$;

commit;
