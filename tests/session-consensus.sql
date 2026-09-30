-- Integration check against the deployed RPCs and RLS.
-- The inner block is a subtransaction. ZX001 always rolls back every fixture.
-- Any failed assertion aborts the entire statement, also rolling it back.
DO $qa$
DECLARE
  a uuid := '92ff0001-0930-4000-8000-000000000001';
  b uuid := '92ff0001-0930-4000-8000-000000000002';
  c uuid := '92ff0001-0930-4000-8000-000000000003';
  sid uuid;
  scode text;
  mid bigint;
  outcome record;
BEGIN
  BEGIN
    INSERT INTO auth.users(id, aud, role, is_anonymous, raw_user_meta_data)
    VALUES (a, 'authenticated', 'authenticated', true, '{"qa":"cinema-home-20260930"}'),
           (b, 'authenticated', 'authenticated', true, '{"qa":"cinema-home-20260930"}'),
           (c, 'authenticated', 'authenticated', true, '{"qa":"cinema-home-20260930"}');
    SELECT id INTO STRICT mid FROM public.movies ORDER BY id LIMIT 1;

    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', a::text, true);
    SELECT id, code INTO STRICT sid, scode FROM public.create_session();
    INSERT INTO public.reactions(session_id,user_id,movie_id,value) VALUES(sid,a,mid,1);
    SELECT * INTO STRICT outcome FROM public.check_session_match(sid,mid);
    IF outcome.is_match OR outcome.member_count <> 1 OR outcome.like_count <> 1 THEN
      RAISE EXCEPTION 'One person must not produce a match';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', b::text, true);
    PERFORM public.join_session(lower(scode));
    SELECT * INTO STRICT outcome FROM public.check_session_match(sid,mid);
    IF outcome.is_match OR outcome.member_count <> 2 OR outcome.like_count <> 1 THEN
      RAISE EXCEPTION 'Two people, one like must not produce a match';
    END IF;
    INSERT INTO public.reactions(session_id,user_id,movie_id,value) VALUES(sid,b,mid,1);
    SELECT * INTO STRICT outcome FROM public.check_session_match(sid,mid);
    IF NOT outcome.is_match OR outcome.member_count <> 2 OR outcome.like_count <> 2 THEN
      RAISE EXCEPTION 'Two people, two likes must produce a match';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', c::text, true);
    PERFORM public.join_session(scode);
    SELECT * INTO STRICT outcome FROM public.check_session_match(sid,mid);
    IF outcome.is_match OR outcome.member_count <> 3 OR outcome.like_count <> 2 THEN
      RAISE EXCEPTION 'A third member must require a third like';
    END IF;
    INSERT INTO public.reactions(session_id,user_id,movie_id,value) VALUES(sid,c,mid,1);
    SELECT * INTO STRICT outcome FROM public.check_session_match(sid,mid);
    IF NOT outcome.is_match OR outcome.member_count <> 3 OR outcome.like_count <> 3 THEN
      RAISE EXCEPTION 'Three people, three likes must produce a match';
    END IF;

    -- An expired session must reject joining through the real RPC.
    EXECUTE 'SET LOCAL ROLE postgres';
    UPDATE public.sessions SET expires_at=now()-interval '1 second' WHERE id=sid;
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      PERFORM public.join_session(scode);
      RAISE EXCEPTION 'Expired session unexpectedly accepted joining';
    EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
    END;

    RAISE EXCEPTION 'Deliberate rollback of all QA fixtures' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN (a,b,c))
     OR EXISTS (SELECT 1 FROM public.users WHERE id IN (a,b,c))
     OR EXISTS (SELECT 1 FROM public.sessions WHERE id=sid)
     OR EXISTS (SELECT 1 FROM public.session_members WHERE user_id IN (a,b,c))
     OR EXISTS (SELECT 1 FROM public.reactions WHERE user_id IN (a,b,c)) THEN
    RAISE EXCEPTION 'QA fixtures were not completely rolled back';
  END IF;
END
$qa$;
SELECT 'passed: minimum two, consensus with two and three, expired session, RLS writes, fixtures rolled back' AS verification;
