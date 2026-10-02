-- Administrator-run checks; every generated user, room and reaction rolls back.
begin;
select set_config('mm.vote_a',gen_random_uuid()::text,true), set_config('mm.vote_b',gen_random_uuid()::text,true), set_config('mm.vote_c',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select current_setting(key)::uuid,'authenticated','authenticated',false,now(),'{}','{}',now(),now()
from unnest(array['mm.vote_a','mm.vote_b','mm.vote_c']) key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.vote_a'),true);
with w as (insert into public.watched_movies(user_id,tmdb_id,title) values(auth.uid(),900000009,'Transactional vote fixture') returning id)
select set_config('mm.review',id::text,true) from w;
insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.review')::uuid,900000009,'Test reviewer',4);
do $$ begin
  begin insert into public.review_votes values(current_setting('mm.review')::uuid,auth.uid(),1); raise exception 'Self vote accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.vote_b'),true);
insert into public.review_votes values(current_setting('mm.review')::uuid,auth.uid(),1);
do $$ begin
  begin insert into public.review_votes values(current_setting('mm.review')::uuid,auth.uid(),-1); raise exception 'Duplicate vote accepted'; exception when unique_violation then null; end;
  begin insert into public.review_votes values(current_setting('mm.review')::uuid,current_setting('mm.vote_c')::uuid,1); raise exception 'Forged voter accepted'; exception when insufficient_privilege then null; end;
  begin update public.review_votes set value=0 where user_id=auth.uid(); raise exception 'Invalid vote accepted'; exception when check_violation then null; end;
  begin update public.review_votes set user_id=current_setting('mm.vote_c')::uuid; raise exception 'Voter changed'; exception when insufficient_privilege then null; end;
  assert (select upvotes=1 and downvotes=0 and my_vote=1 from public.movie_review_votes(array[current_setting('mm.review')::uuid]));
  begin perform * from public.movie_review_votes(array_fill(current_setting('mm.review')::uuid,array[201])); raise exception 'Unbounded request accepted'; exception when invalid_parameter_value then null; end;
end $$;
update public.review_votes set value=-1 where user_id=auth.uid();
select set_config('request.jwt.claim.sub',current_setting('mm.vote_c'),true);
insert into public.review_votes values(current_setting('mm.review')::uuid,auth.uid(),1);
do $$ declare affected integer; begin
  assert (select count(*) from public.review_votes)=1, 'Other voter identity leaked';
  assert (select upvotes=1 and downvotes=1 and my_vote=1 from public.movie_review_votes(array[current_setting('mm.review')::uuid]));
  delete from public.review_votes where user_id=current_setting('mm.vote_b')::uuid;
  get diagnostics affected=row_count; assert affected=0,'Deleted someone else vote';
end $$;
delete from public.review_votes where user_id=auth.uid();
select set_config('request.jwt.claim.sub',current_setting('mm.vote_a'),true);
delete from public.movie_reviews where id=current_setting('mm.review')::uuid;
reset role;
do $$ begin assert not exists(select 1 from public.review_votes where review_id=current_setting('mm.review')::uuid),'Orphan votes'; end $$;

-- Demo membership gets initial likes; normal sessions retain normal behavior.
with s as(insert into public.sessions(code) values('TXDEMO') returning id) select set_config('mm.demo',id::text,true) from s;
with s as(insert into public.sessions(code) values('TXNORM') returning id) select set_config('mm.normal',id::text,true) from s;
insert into public.movies(id,tmdb_id,title) values(900000009,900000009,'Demo fixture');
insert into private.demo_sessions values(current_setting('mm.demo')::uuid,array[900000009]::bigint[]);
insert into public.session_members(session_id,user_id) values(current_setting('mm.demo')::uuid,current_setting('mm.vote_a')::uuid),(current_setting('mm.demo')::uuid,current_setting('mm.vote_b')::uuid),(current_setting('mm.normal')::uuid,current_setting('mm.vote_a')::uuid);
do $$ begin
  assert (select count(*) from public.reactions where session_id=current_setting('mm.demo')::uuid and value=1)=2,'Demo was not seeded';
  assert not exists(select 1 from public.reactions where session_id=current_setting('mm.normal')::uuid),'Normal room was changed';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.vote_a'),true);
do $$ begin
  assert public.is_demo_session(current_setting('mm.demo')::uuid),'Demo member missing flag';
  assert not public.is_demo_session(current_setting('mm.normal')::uuid),'Normal room flagged';
  begin perform * from private.demo_sessions; raise exception 'Private demo configuration exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.vote_c'),true);
do $$ begin assert not public.is_demo_session(current_setting('mm.demo')::uuid),'Demo flag exposed to nonmember'; end $$;
set local role anon;
do $$ begin
  begin perform * from public.review_votes; raise exception 'Anonymous vote access'; exception when insufficient_privilege then null; end;
  perform * from public.movie_review_votes(array[current_setting('mm.review')::uuid]);
end $$;
reset role;
rollback;
select 'Review votes, private counts, demo seeding and isolation passed; fixtures rolled back.' as result;
