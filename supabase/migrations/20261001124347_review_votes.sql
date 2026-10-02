-- One private reaction per person and review; switching direction updates that row.
create table public.review_votes (
  review_id uuid not null references public.movie_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (review_id, user_id)
);
create index review_votes_user_idx on public.review_votes(user_id, review_id);
alter table public.review_votes enable row level security;
revoke all on public.review_votes from anon, authenticated;
grant select, delete on public.review_votes to authenticated;
grant insert (review_id, user_id, value) on public.review_votes to authenticated;
grant update (value) on public.review_votes to authenticated;
create policy review_votes_read_own on public.review_votes for select to authenticated using (user_id = (select auth.uid()));
create policy review_votes_insert_own on public.review_votes for insert to authenticated with check (
  user_id = (select auth.uid()) and not exists (select 1 from public.watched_movies w where w.id = review_votes.review_id)
);
create policy review_votes_update_own on public.review_votes for update to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and not exists (select 1 from public.watched_movies w where w.id = review_votes.review_id)
);
create policy review_votes_delete_own on public.review_votes for delete to authenticated using (user_id = (select auth.uid()));

-- Counts must include other people's votes while voter identities stay private.
-- The definer helper is outside the exposed schema and returns only totals + the
-- caller's own choice. It has a fixed search_path and a bounded request size.
create function private.review_vote_totals(p_review_ids uuid[])
returns table (review_id uuid, upvotes bigint, downvotes bigint, my_vote smallint)
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if coalesce(cardinality(p_review_ids), 0) > 200 then raise invalid_parameter_value using message = 'At most 200 review IDs'; end if;
  return query
    select r.id, count(v.user_id) filter (where v.value = 1), count(v.user_id) filter (where v.value = -1),
      coalesce(max(v.value) filter (where v.user_id = caller), 0)::smallint
    from public.movie_reviews r left join public.review_votes v on v.review_id = r.id
    where r.id = any(p_review_ids) group by r.id;
end;
$$;
revoke all on function private.review_vote_totals(uuid[]) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.review_vote_totals(uuid[]) to authenticated;

create function public.movie_review_votes(p_review_ids uuid[])
returns table (review_id uuid, upvotes bigint, downvotes bigint, my_vote smallint)
language sql stable security invoker set search_path = '' as $$
  select * from private.review_vote_totals(p_review_ids);
$$;
revoke all on function public.movie_review_votes(uuid[]) from public, anon;
grant execute on function public.movie_review_votes(uuid[]) to authenticated;
