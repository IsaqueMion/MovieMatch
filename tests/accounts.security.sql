-- Run as the project administrator. Fixtures, uploads and rooms are rolled back.
begin;
select set_config('mm.guest',gen_random_uuid()::text,true),set_config('mm.account',gen_random_uuid()::text,true),set_config('mm.other',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,is_anonymous,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select current_setting(key)::uuid,'authenticated','authenticated',key='mm.guest',case when key!='mm.guest' then now() end,'{}','{}',now(),now() from unnest(array['mm.guest','mm.account','mm.other']) key;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.guest'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.guest'),'role','authenticated','is_anonymous',true)::text,true);
select set_config('mm.room',id::text,true),set_config('mm.code',code,true) from public.create_session();
with w as (insert into public.watched_movies(user_id,tmdb_id,title) values(auth.uid(),900000009,'Account security fixture') returning id) select set_config('mm.watch',id::text,true) from w;
do $$ begin
  begin perform public.save_session(current_setting('mm.room')::uuid,'Guest'); raise exception 'Guest saved a room'; exception when insufficient_privilege then null; end;
  begin insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.watch')::uuid,900000009,'Guest',5); raise exception 'Guest published a review'; exception when insufficient_privilege then null; end;
end $$;
select set_config('mm.ticket',public.prepare_guest_transfer()::text,true);
select set_config('request.jwt.claim.sub',current_setting('mm.account'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.account'),'role','authenticated','is_anonymous',false)::text,true);
select set_config('mm.profile',(public.my_profile()->>'id'),true),set_config('mm.handle',(public.my_profile()->>'handle'),true);
do $$ begin
  begin perform public.save_session(current_setting('mm.room')::uuid,'Not a member'); raise exception 'Nonmember saved room'; exception when insufficient_privilege then null; end;
  begin perform public.claim_guest_transfer(gen_random_uuid()); raise exception 'Forged transfer accepted'; exception when invalid_parameter_value then null; end;
end $$;
select public.claim_guest_transfer(current_setting('mm.ticket')::uuid);
do $$ begin
  assert exists(select 1 from public.watched_movies where id=current_setting('mm.watch')::uuid), 'Guest history was not transferred';
  assert exists(select 1 from public.session_members where session_id=current_setting('mm.room')::uuid and user_id=auth.uid()), 'Guest membership not transferred';
  begin perform public.claim_guest_transfer(current_setting('mm.ticket')::uuid); raise exception 'Ticket reused'; exception when invalid_parameter_value then null; end;
end $$;
select public.save_session(current_setting('mm.room')::uuid,'Persistent fixture');
insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.watch')::uuid,900000009,'Spoofed nickname',4);
insert into public.profile_favorites(profile_id,slot,tmdb_id,title) values(current_setting('mm.profile')::uuid,1,900000009,'Favorite fixture');
update public.profiles set show_favorites=false,show_reviews=false where id=current_setting('mm.profile')::uuid;
do $$ begin
  assert (select display_name from public.movie_reviews where id=current_setting('mm.watch')::uuid)='Novo cinéfilo','Nickname can be impersonated';
  assert jsonb_array_length(public.profile_reviews(current_setting('mm.handle')))=1,'Owner cannot see hidden reviews';
  begin update public.profiles set user_id=current_setting('mm.other')::uuid; raise exception 'Profile ownership changed'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name) values('profile-media',current_setting('mm.profile')||'/avatar-unsafe.html'); raise exception 'Unsafe upload accepted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mm.other'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.other'),'role','authenticated','is_anonymous',false)::text,true);
do $$ declare affected integer; begin
  assert (select count(*) from public.saved_sessions)=0,'Saved rooms leaked';
  assert (select count(*) from public.profile_favorites where profile_id=current_setting('mm.profile')::uuid)=0,'Hidden favorites leaked';
  assert jsonb_array_length(public.profile_reviews(current_setting('mm.handle')))=0,'Hidden profile reviews leaked';
  assert (select review_count from public.movie_review_summary(900000009))=1,'Film review no longer public';
  update public.profiles set bio='Forged' where id=current_setting('mm.profile')::uuid;
  get diagnostics affected=row_count; assert affected=0,'Another account edited profile';
  begin insert into storage.objects(bucket_id,name) values('profile-media',current_setting('mm.profile')||'/avatar-'||gen_random_uuid()||'.webp'); raise exception 'Another account uploaded photo'; exception when insufficient_privilege then null; end;
end $$;
select * from public.join_session(current_setting('mm.code'));
reset role;
do $$ begin
  assert (select expires_at='infinity'::timestamptz from public.sessions where id=current_setting('mm.room')::uuid),'Saved room still expires';
  assert not exists(select 1 from public.session_members where user_id=current_setting('mm.guest')::uuid and session_id=current_setting('mm.room')::uuid),'Guest became a ghost participant';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mm.account'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('mm.account'),'role','authenticated','is_anonymous',false)::text,true);
update public.profiles set is_public=false where id=current_setting('mm.profile')::uuid;
delete from public.saved_sessions where session_id=current_setting('mm.room')::uuid;
reset role;
do $$ begin assert (select expires_at between now()+interval '23 hours' and now()+interval '25 hours' from public.sessions where id=current_setting('mm.room')::uuid),'Unsave expiration incorrect'; end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$ begin
  assert (select count(*) from public.profiles where id=current_setting('mm.profile')::uuid)=0,'Private profile leaked';
  assert jsonb_array_length(public.profile_reviews(current_setting('mm.handle')))=0,'Private review section leaked';
  assert (select review_count from public.movie_review_summary(900000009))=1,'Logged-out public read failed';
  begin perform public.my_profile(); raise exception 'Logged-out profile creation accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
