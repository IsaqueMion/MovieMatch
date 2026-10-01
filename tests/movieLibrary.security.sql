-- Execute as the project administrator. All fixture data is rolled back.
begin;
select set_config('mm.test_user_a', gen_random_uuid()::text, true);
select set_config('mm.test_user_b', gen_random_uuid()::text, true);
insert into auth.users(id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select current_setting(key)::uuid, 'authenticated', 'authenticated', true, '{}'::jsonb, '{}'::jsonb, now(), now()
from unnest(array['mm.test_user_a', 'mm.test_user_b']) as key;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('mm.test_user_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('mm.test_user_a'), 'role', 'authenticated', 'is_anonymous', true)::text, true);
with row as (insert into public.watched_movies(user_id, tmdb_id, title, year) values (auth.uid(), 900000001, 'MovieMatch transactional security fixture', 2000) returning id)
select set_config('mm.test_watch_a', id::text, true) from row;
insert into public.movie_reviews(id, tmdb_id, display_name, rating, comment, contains_spoilers)
values(current_setting('mm.test_watch_a')::uuid, 900000001, 'Pessoa A', 4, 'Comentário de teste', true);
do $$ begin
  assert (select count(*) from public.watched_movies) = 1, 'Owner must see their watch';
  assert (select review_count from public.movie_review_summary(900000001)) = 1, 'Summary count';
  assert not (select to_jsonb(r) ? 'user_id' from public.movie_reviews r where id=current_setting('mm.test_watch_a')::uuid), 'Public rows must not expose owner identity';
  begin
    insert into public.watched_movies(user_id,tmdb_id,title) values(auth.uid(),900000001,'Duplicate');
    raise exception 'Duplicate watch accepted';
  exception when unique_violation then null; end;
  begin
    update public.movie_reviews set rating=6 where id=current_setting('mm.test_watch_a')::uuid;
    raise exception 'Invalid rating accepted';
  exception when check_violation then null; end;
  begin
    update public.movie_reviews set comment=repeat('x',1001) where id=current_setting('mm.test_watch_a')::uuid;
    raise exception 'Oversized comment accepted';
  exception when check_violation then null; end;
  begin
    update public.movie_reviews set created_at=now()-interval '1 year' where id=current_setting('mm.test_watch_a')::uuid;
    raise exception 'Review date spoofing accepted';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('mm.test_user_b'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('mm.test_user_b'), 'role', 'authenticated', 'is_anonymous', true)::text, true);
do $$ declare affected integer; begin
  assert (select count(*) from public.watched_movies) = 0, 'Another person saw private history';
  assert (select count(*) from public.movie_reviews where tmdb_id=900000001) = 1, 'Public review must be readable by another user';
  update public.movie_reviews set rating=1 where id=current_setting('mm.test_watch_a')::uuid;
  get diagnostics affected = row_count;
  assert affected=0, 'Another person changed a review';
  delete from public.movie_reviews where id=current_setting('mm.test_watch_a')::uuid;
  get diagnostics affected = row_count;
  assert affected=0, 'Another person deleted a review';
  delete from public.watched_movies where id=current_setting('mm.test_watch_a')::uuid;
  get diagnostics affected = row_count;
  assert affected=0, 'Another person deleted a watch';
  begin
    insert into public.watched_movies(user_id,tmdb_id,title) values(current_setting('mm.test_user_a')::uuid,900000002,'Forged owner');
    raise exception 'Forged watch owner accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.test_watch_a')::uuid,900000001,'Forged review',1);
    raise exception 'Review for another person accepted';
  exception when insufficient_privilege then null; end;
end $$;
with row as (insert into public.watched_movies(user_id,tmdb_id,title) values(auth.uid(),900000001,'Same film, different person') returning id)
select set_config('mm.test_watch_b',id::text,true) from row;
do $$ begin
  begin
    insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.test_watch_b')::uuid,900000002,'Wrong film',2);
    raise exception 'Review for a different movie accepted';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.test_watch_b')::uuid,900000001,'Pessoa B',2);
do $$ begin
  assert (select count(*) from public.watched_movies) = 1, 'History is not isolated';
  assert (select review_count from public.movie_review_summary(900000001)) = 2, 'Community count ignores another reviewer';
  assert (select average_rating from public.movie_review_summary(900000001)) = 3, 'Community average incorrect';
end $$;

select set_config('request.jwt.claim.sub', current_setting('mm.test_user_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('mm.test_user_a'), 'role', 'authenticated')::text, true);
update public.movie_reviews set rating=5, comment='Atualizado' where id=current_setting('mm.test_watch_a')::uuid;
do $$ begin
  assert (select average_rating from public.movie_review_summary(900000001)) = 3.5, 'Owner edit failed';
end $$;
delete from public.movie_reviews where id=current_setting('mm.test_watch_a')::uuid;
do $$ begin
  assert (select count(*) from public.watched_movies)=1, 'Deleting a review deleted the watch';
end $$;
insert into public.movie_reviews(id,tmdb_id,display_name,rating) values(current_setting('mm.test_watch_a')::uuid,900000001,'Pessoa A',4);
delete from public.watched_movies where id=current_setting('mm.test_watch_a')::uuid;
do $$ begin
  assert (select count(*) from public.watched_movies)=0, 'Owner could not unmark';
  assert (select count(*) from public.movie_reviews where id=current_setting('mm.test_watch_a')::uuid)=0, 'Unmark left an orphan review';
  assert (select review_count from public.movie_review_summary(900000001))=1, 'Unmark deleted another person review';
end $$;
set local role anon;
do $$ begin
  begin perform id from public.watched_movies; raise exception 'Unauthenticated history access accepted'; exception when insufficient_privilege then null; end;
  begin perform id from public.movie_reviews; raise exception 'Unauthenticated review access accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Movie library permissions and constraints passed; all fixture users and rows rolled back.' as result;
