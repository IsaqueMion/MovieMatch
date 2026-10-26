-- Isolated fixtures, always rolled back. Run as administrator after the migration.
begin;
select set_config('mm.minor',gen_random_uuid()::text,true),set_config('mm.adult',gen_random_uuid()::text,true),set_config('mm.guest',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select current_setting(key)::uuid,'authenticated','authenticated',key='mm.guest','{}',
  jsonb_build_object('birthdate',case when key='mm.minor' then (((now() at time zone 'UTC')::date-interval '18 years')::date+1)::text when key='mm.adult' then ((now() at time zone 'UTC')::date-interval '18 years')::date::text else '1990-01-01' end),now(),now()
from unnest(array['mm.minor','mm.adult','mm.guest']) key;
do $$ begin
  assert (select birthdate is null from public.users where id=current_setting('mm.guest')::uuid),'Guest metadata must not set birthdate';
  begin
    insert into auth.users(id,is_anonymous,raw_user_meta_data) values(gen_random_uuid(),false,jsonb_build_object('birthdate','2099-01-01'));
    raise exception 'Future birthday accepted';
  exception when invalid_parameter_value then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.minor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.minor'),'role','authenticated')::text,true);
do $$ declare dob date; begin
  assert not public.adult_content_allowed(),'Minor allowed';
  assert (select count(*) from public.users)=1,'Another user birthday leaked';
  update public.users set is_adult=true where id=auth.uid();
  assert not public.adult_content_allowed(),'Legacy flag bypassed birthday';
  select birthdate into dob from public.users where id=auth.uid();
  assert public.set_birthdate(dob)=dob,'Idempotent birthday failed';
  begin perform public.set_birthdate(date '1990-01-01');raise exception 'Birthday overwrite allowed';exception when insufficient_privilege then null;end;
  begin update public.users set birthdate=date '1990-01-01' where id=auth.uid();raise exception 'Direct birthday write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set raw_user_meta_data=jsonb_build_object('birthdate','1990-01-01') where id=current_setting('mm.minor')::uuid;
set local role authenticated;
do $$ begin assert not public.adult_content_allowed(),'Mutable metadata bypassed age'; end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.adult'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.adult'),'role','authenticated')::text,true);
do $$ begin assert public.adult_content_allowed(),'18th birthday did not unlock'; end $$;
reset role;
-- A stored flag from yesterday must not keep the new adult blocked.
update public.users set birthdate=((now() at time zone 'UTC')::date-interval '18 years')::date where id=current_setting('mm.minor')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.minor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.minor'),'role','authenticated')::text,true);
do $$ begin
  assert (select not is_adult from public.users where id=auth.uid()),'Fixture must retain old false flag';
  assert public.adult_content_allowed(),'Birthday depends on stale flag';
end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.guest'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.guest'),'role','authenticated')::text,true);
do $$ begin
  assert not public.adult_content_allowed(),'Unknown guest allowed';
  begin perform public.set_birthdate(null);raise exception 'Null accepted';exception when invalid_parameter_value then null;end;
  begin perform public.set_birthdate(date '1899-01-01');raise exception 'Old date accepted';exception when invalid_parameter_value then null;end;
  begin perform public.set_birthdate(date '2099-01-01');raise exception 'Future date accepted';exception when invalid_parameter_value then null;end;
  perform public.set_birthdate(date '1990-01-01');assert public.adult_content_allowed(),'Recorded adult guest blocked';
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.adult_content_allowed();raise exception 'Unauthenticated RPC access';exception when insufficient_privilege then null;end;
 begin perform public.set_birthdate(date '1990-01-01');raise exception 'Unauthenticated birthday write';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'age security checks passed; fixtures rolled back' as result;
