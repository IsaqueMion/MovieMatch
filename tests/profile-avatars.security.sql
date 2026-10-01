-- Transactional fixtures: no test participants or profiles remain after execution.
begin;
select set_config('mm.guest',gen_random_uuid()::text,true),set_config('mm.public',gen_random_uuid()::text,true),set_config('mm.private',gen_random_uuid()::text,true),set_config('mm.outsider',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select current_setting(key)::uuid,'authenticated','authenticated',key='mm.guest',case when key!='mm.guest' then now() end,'{}','{}',now(),now() from unnest(array['mm.guest','mm.public','mm.private','mm.outsider']) key;
insert into public.profiles(user_id,display_name,bio,is_public) values
  (current_setting('mm.public')::uuid,'Public fixture','Public bio',true),
  (current_setting('mm.private')::uuid,'Secret fixture','Private bio',false);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.guest'),true);
select set_config('mm.room',id::text,true),set_config('mm.code',code,true) from public.create_session();
select set_config('request.jwt.claim.sub',current_setting('mm.public'),true);
select * from public.join_session(current_setting('mm.code'));
select set_config('request.jwt.claim.sub',current_setting('mm.private'),true);
select * from public.join_session(current_setting('mm.code'));
do $$ begin assert public.session_participants(current_setting('mm.room')::uuid)::text like '%Secret fixture%', 'Owner cannot see own private profile'; end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.guest'),true);
do $$ declare result jsonb:=public.session_participants(current_setting('mm.room')::uuid); begin
  assert jsonb_array_length(result)=3, 'Missing members';
  assert result::text like '%Public fixture%' and result::text like '%Convidado%', 'Public profile or guest missing';
  assert result::text not like '%Secret fixture%' and result::text not like '%Private bio%', 'Private identity leaked';
  assert result::text not like '%'||current_setting('mm.public')||'%', 'Auth ID leaked';
  assert result::text not like '%user_id%' and result::text not like '%email%', 'Unexpected private fields';
end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.outsider'),true);
do $$ begin
  begin perform public.session_participants(current_setting('mm.room')::uuid); raise exception 'Nonmember read room'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.session_members set last_seen_at=now()-interval '2 minutes' where user_id=current_setting('mm.public')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.guest'),true);
do $$ begin assert exists(select 1 from jsonb_array_elements(public.session_participants(current_setting('mm.room')::uuid)) p where p->>'display_name'='Public fixture' and p->>'online'='false'), 'Offline member missing or shown online'; end $$;
reset role;
update public.session_members set left_at=now() where user_id=current_setting('mm.private')::uuid;
set local role authenticated;
do $$ begin assert jsonb_array_length(public.session_participants(current_setting('mm.room')::uuid))=2, 'Departed participant retained'; end $$;
reset role;
update public.sessions set expires_at=now()-interval '1 second' where id=current_setting('mm.room')::uuid;
set local role authenticated;
do $$ begin
  begin perform public.session_participants(current_setting('mm.room')::uuid); raise exception 'Expired room read'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare result jsonb:=public.community_profiles(); begin
  assert jsonb_array_length(result)<=3, 'Unbounded sample';
  assert result::text not like '%Secret fixture%' and result::text not like '%user_id%' and result::text not like '%email%', 'Private homepage fields leaked';
  begin perform public.session_participants(current_setting('mm.room')::uuid); raise exception 'Anonymous room read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
