begin;
select set_config('mm.user_id', gen_random_uuid()::text, true);
insert into auth.users(id,aud,role,is_anonymous,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values(current_setting('mm.user_id')::uuid,'authenticated','authenticated',false,'{}',jsonb_build_object('birthdate','1990-01-01'),now(),now());
do $$ begin
  assert not ((select raw_user_meta_data from auth.users where id=current_setting('mm.user_id')::uuid) ? 'birthdate'), 'Auth metadata retained birthdate';
  assert (select birthdate is null and not is_adult from public.users where id=current_setting('mm.user_id')::uuid), 'Profile retained birthdate or adult status';
  assert not public.adult_content_allowed(), 'Adult RPC enabled content';
  assert public.set_birthdate(date '1990-01-01') is null, 'Legacy birthday RPC did not no-op';
end $$;
update auth.users set raw_user_meta_data=jsonb_build_object('birthdate','1990-01-01') where id=current_setting('mm.user_id')::uuid;
do $$ begin
  assert not ((select raw_user_meta_data from auth.users where id=current_setting('mm.user_id')::uuid) ? 'birthdate'), 'Auth metadata update restored birthdate';
end $$;
rollback;
