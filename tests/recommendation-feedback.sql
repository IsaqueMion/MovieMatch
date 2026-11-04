-- Run against the migrated database. Every fixture is rolled back.
do $qa$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  sid uuid;
  second_sid uuid;
  mid bigint;
  count_rows integer;
begin
  begin
    insert into auth.users(id, aud, role, is_anonymous, raw_user_meta_data)
    values (a, 'authenticated', 'authenticated', true, '{"qa":"recommendations"}'),
           (b, 'authenticated', 'authenticated', true, '{"qa":"recommendations"}');
    select id into strict mid from public.movies order by id limit 1;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', a::text, true);
    select id into strict sid from public.create_session();

    perform public.record_movie_reaction(sid, mid, 1, array[878,878]);
    perform public.record_movie_reaction(sid, mid, -1, array[878]);
    select count(*) into count_rows from public.recommendation_feedback
      where user_id=a and session_id=sid and value=-1 and genre_ids=array[878];
    if count_rows <> 1 then raise exception 'Retries must update one training row'; end if;
    if (select value from public.reactions where session_id=sid and user_id=a and movie_id=mid) <> -1 then
      raise exception 'Vote and feedback must commit together';
    end if;

    begin
      perform public.record_movie_reaction(sid, mid, 0, array[35]);
      raise exception 'Invalid value unexpectedly accepted';
    exception when sqlstate '22023' then null; end;

    perform set_config('request.jwt.claim.sub', b::text, true);
    if exists (select 1 from public.list_my_recommendation_feedback()) then
      raise exception 'Private taste leaked to another person';
    end if;
    if exists (select 1 from public.recommendation_feedback where user_id=a) then
      raise exception 'Direct table access bypassed profile privacy';
    end if;
    begin
      perform public.record_movie_reaction(sid, mid, 1, array[35]);
      raise exception 'Nonmember vote unexpectedly accepted';
    exception when sqlstate '42501' then null; end;
    begin
      insert into public.recommendation_feedback(user_id,session_id,movie_id,value)
        values(a,sid,mid,1);
      raise exception 'Forged ownership unexpectedly accepted';
    exception when sqlstate '42501' then null; end;

    perform set_config('request.jwt.claim.sub', a::text, true);
    select id into strict second_sid from public.create_session();
    perform public.record_movie_reaction(second_sid, mid, 1, array[35]);
    perform public.undo_movie_reaction(second_sid, mid);
    if exists (select 1 from public.recommendation_feedback where session_id=second_sid) then
      raise exception 'Undo retained its training signal';
    end if;
    if not exists (select 1 from public.recommendation_feedback where session_id=sid and value=-1) then
      raise exception 'Undo removed previous-session feedback';
    end if;

    execute 'set local role postgres';
    update public.sessions set expires_at=now()-interval '1 second' where id=sid;
    execute 'set local role authenticated';
    if not exists (select 1 from public.list_my_recommendation_feedback()) then
      raise exception 'Expired session erased personal taste';
    end if;
    begin
      perform public.record_movie_reaction(sid, mid, 1, array[35]);
      raise exception 'Expired room unexpectedly accepted a vote';
    exception when sqlstate '42501' then null; end;

    execute 'set local role postgres';
    delete from public.sessions where id=sid;
    if not exists (select 1 from public.recommendation_feedback where user_id=a and session_id=sid) then
      raise exception 'Room deletion erased personal taste';
    end if;
    delete from auth.users where id=a;
    if exists (select 1 from public.recommendation_feedback where user_id=a) then
      raise exception 'Account deletion did not clear private feedback';
    end if;
    raise exception 'Rollback QA fixtures' using errcode='ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  if exists (select 1 from auth.users where id in (a,b))
    or exists (select 1 from public.recommendation_feedback where user_id in (a,b)) then
    raise exception 'QA fixtures were not rolled back';
  end if;
end
$qa$;
