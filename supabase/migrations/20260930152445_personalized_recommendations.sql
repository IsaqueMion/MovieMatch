-- Durable personal feedback: session_id deliberately has no session FK.
-- Expiring or removing a room must not erase the person's learned taste.
create table public.recommendation_feedback (
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null,
  movie_id bigint not null references public.movies(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  genre_ids integer[] not null default '{}'
    check (cardinality(genre_ids) <= 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id, movie_id)
);

create index recommendation_feedback_user_recent_idx
  on public.recommendation_feedback(user_id, updated_at desc, movie_id);
create index recommendation_feedback_movie_idx
  on public.recommendation_feedback(movie_id);

alter table public.recommendation_feedback enable row level security;
revoke all on public.recommendation_feedback from public, anon, authenticated;
grant select, insert, update, delete on public.recommendation_feedback to authenticated;

create policy recommendation_feedback_select_self
  on public.recommendation_feedback for select to authenticated
  using (user_id = (select auth.uid()));

create policy recommendation_feedback_insert_self
  on public.recommendation_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.reactions r
      where r.user_id = recommendation_feedback.user_id
        and r.session_id = recommendation_feedback.session_id
        and r.movie_id = recommendation_feedback.movie_id
        and r.value = recommendation_feedback.value
    )
  );

create policy recommendation_feedback_update_self
  on public.recommendation_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.reactions r
      where r.user_id = recommendation_feedback.user_id
        and r.session_id = recommendation_feedback.session_id
        and r.movie_id = recommendation_feedback.movie_id
        and r.value = recommendation_feedback.value
    )
  );

create policy recommendation_feedback_delete_self
  on public.recommendation_feedback for delete to authenticated
  using (user_id = (select auth.uid()));

-- Preserve previous choices. Genre-less historical votes are not strong
-- training evidence; their movie year is still available when reading.
insert into public.recommendation_feedback(user_id, session_id, movie_id, value, updated_at)
select user_id, session_id, movie_id, value, created_at from public.reactions
on conflict do nothing;

create function public.record_movie_reaction(
  p_session_id uuid, p_movie_id bigint, p_value integer,
  p_genre_ids integer[] default '{}'
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_genres integer[];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_value is null or p_value not in (-1, 1)
    or cardinality(coalesce(p_genre_ids, '{}')) > 20 then
    raise exception 'Invalid reaction' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct genre), '{}'::integer[])
  into v_genres
  from unnest(coalesce(p_genre_ids, '{}')) as genre
  where genre > 0;

  -- Existing reactions RLS authorizes active session membership.
  insert into public.reactions(session_id, user_id, movie_id, value)
  values (p_session_id, v_user_id, p_movie_id, p_value)
  on conflict (session_id, user_id, movie_id)
  do update set value = excluded.value;

  insert into public.recommendation_feedback(user_id, session_id, movie_id, value, genre_ids)
  values (v_user_id, p_session_id, p_movie_id, p_value, v_genres)
  on conflict (user_id, session_id, movie_id)
  do update set value = excluded.value, genre_ids = excluded.genre_ids, updated_at = now();
end;
$$;

create function public.undo_movie_reaction(p_session_id uuid, p_movie_id bigint)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.reactions
  where session_id = p_session_id and movie_id = p_movie_id and user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Reaction unavailable' using errcode = '42501';
  end if;
  delete from public.recommendation_feedback
  where session_id = p_session_id and movie_id = p_movie_id and user_id = v_user_id;
end;
$$;

create function public.list_my_recommendation_feedback(p_limit integer default 500)
returns table (
  session_id uuid, tmdb_id bigint, year integer, value smallint,
  genre_ids integer[], updated_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select f.session_id, m.tmdb_id, m.year, f.value, f.genre_ids, f.updated_at
  from public.recommendation_feedback f
  join public.movies m on m.id = f.movie_id
  where f.user_id = (select auth.uid())
  order by f.updated_at desc, f.movie_id
  limit greatest(1, least(coalesce(p_limit, 500), 500));
$$;

revoke all on function public.record_movie_reaction(uuid, bigint, integer, integer[]) from public, anon;
revoke all on function public.undo_movie_reaction(uuid, bigint) from public, anon;
revoke all on function public.list_my_recommendation_feedback(integer) from public, anon;
grant execute on function public.record_movie_reaction(uuid, bigint, integer, integer[]) to authenticated;
grant execute on function public.undo_movie_reaction(uuid, bigint) to authenticated;
grant execute on function public.list_my_recommendation_feedback(integer) to authenticated;
