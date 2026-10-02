-- Personal history is independent of a session and survives session expiration.
create table public.watched_movies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id bigint not null check (tmdb_id > 0),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  year integer check (year between 1800 and 2200),
  poster_url text check (char_length(poster_url) <= 2000),
  watched_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);
create index watched_movies_user_date_idx on public.watched_movies(user_id, watched_at desc, id);
alter table public.watched_movies enable row level security;
revoke all on public.watched_movies from anon, authenticated;
grant select, delete on public.watched_movies to authenticated;
grant insert (user_id, tmdb_id, title, year, poster_url) on public.watched_movies to authenticated;
create policy watched_read_own on public.watched_movies for select to authenticated using ((select auth.uid()) = user_id);
create policy watched_insert_own on public.watched_movies for insert to authenticated with check ((select auth.uid()) = user_id);
create policy watched_delete_own on public.watched_movies for delete to authenticated using ((select auth.uid()) = user_id);

-- A review uses the personal watch ID. Public rows contain no auth user ID,
-- email, session code or watch date. Deleting a watch deletes its review too.
create table public.movie_reviews (
  id uuid primary key references public.watched_movies(id) on delete cascade,
  tmdb_id bigint not null check (tmdb_id > 0),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 32),
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index movie_reviews_movie_date_idx on public.movie_reviews(tmdb_id, created_at desc, id desc);
alter table public.movie_reviews enable row level security;
revoke all on public.movie_reviews from anon, authenticated;
grant select, delete on public.movie_reviews to authenticated;
grant insert (id, tmdb_id, display_name, rating, comment, contains_spoilers) on public.movie_reviews to authenticated;
grant update (display_name, rating, comment, contains_spoilers) on public.movie_reviews to authenticated;
create policy reviews_read_community on public.movie_reviews for select to authenticated using (true);
create policy reviews_insert_own on public.movie_reviews for insert to authenticated with check (
  exists (select 1 from public.watched_movies w where w.id = movie_reviews.id and w.tmdb_id = movie_reviews.tmdb_id and w.user_id = (select auth.uid()))
);
create policy reviews_update_own on public.movie_reviews for update to authenticated using (
  exists (select 1 from public.watched_movies w where w.id = movie_reviews.id and w.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.watched_movies w where w.id = movie_reviews.id and w.tmdb_id = movie_reviews.tmdb_id and w.user_id = (select auth.uid()))
);
create policy reviews_delete_own on public.movie_reviews for delete to authenticated using (
  exists (select 1 from public.watched_movies w where w.id = movie_reviews.id and w.user_id = (select auth.uid()))
);

create function public.touch_movie_review() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_movie_review() from public, anon, authenticated;
create trigger touch_movie_review before update on public.movie_reviews for each row execute function public.touch_movie_review();

-- Aggregate the whole movie's reviews, independently of the paginated feed.
create function public.movie_review_summary(p_tmdb_id bigint)
returns table (average_rating numeric, review_count bigint)
language sql stable security invoker set search_path = '' as $$
  select round(avg(r.rating)::numeric, 1), count(*) from public.movie_reviews r where r.tmdb_id = p_tmdb_id;
$$;
revoke all on function public.movie_review_summary(bigint) from public, anon;
grant execute on function public.movie_review_summary(bigint) to authenticated;
