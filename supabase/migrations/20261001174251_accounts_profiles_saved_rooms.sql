-- Accounts add persistence; anonymous room participation remains unchanged.
create function private.has_account() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid() and not is_anonymous and email_confirmed_at is not null);
$$;
revoke all on function private.has_account() from public, anon;
grant execute on function private.has_account() to authenticated;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  handle text not null unique default ('cine-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) check(handle ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  display_name text not null default 'Novo cinéfilo' check(char_length(btrim(display_name)) between 2 and 32),
  bio text not null default '' check(char_length(bio) <= 280),
  avatar_path text,
  cover_path text,
  genres integer[] not null default '{}' check(cardinality(genres) <= 5),
  is_public boolean not null default true,
  show_favorites boolean not null default true,
  show_reviews boolean not null default true,
  check(avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar-[a-f0-9-]+\.webp$')),
  check(cover_path is null or cover_path ~ ('^' || id::text || '/cover-[a-f0-9-]+\.webp$'))
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select(id,handle,display_name,bio,avatar_path,cover_path,genres,is_public,show_favorites,show_reviews) on public.profiles to anon, authenticated;
grant update(handle,display_name,bio,avatar_path,cover_path,genres,is_public,show_favorites,show_reviews) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select using (is_public or user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using(user_id = (select auth.uid()) and (select private.has_account())) with check(user_id = (select auth.uid()) and (select private.has_account()));
create function private.owns_profile(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=p_id and user_id=auth.uid());
$$;
revoke all on function private.owns_profile(uuid) from public;
grant usage on schema private to anon;
grant execute on function private.owns_profile(uuid) to anon,authenticated;
create function public.my_profile() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.has_account() then raise insufficient_privilege using message = 'Account required'; end if;
  insert into public.profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select to_jsonb(p) - 'user_id' into result from public.profiles p where user_id = auth.uid();
  return result;
end;
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

create table public.profile_favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check(slot between 1 and 4),
  tmdb_id bigint not null check(tmdb_id > 0),
  title text not null check(char_length(btrim(title)) between 1 and 300),
  year integer check(year between 1800 and 2200),
  poster_url text check(poster_url ~ '^https://image\.tmdb\.org/t/p/(w[0-9]+|original)/[a-zA-Z0-9]+\.(jpg|png)$'),
  primary key(profile_id,slot), unique(profile_id,tmdb_id)
);
alter table public.profile_favorites enable row level security;
revoke all on public.profile_favorites from anon, authenticated;
grant select on public.profile_favorites to anon, authenticated;
grant insert,update,delete on public.profile_favorites to authenticated;
create policy favorites_read on public.profile_favorites for select using(exists(select 1 from public.profiles p where p.id=profile_id and p.is_public and p.show_favorites) or private.owns_profile(profile_id));
create policy favorites_write on public.profile_favorites for all to authenticated using(private.owns_profile(profile_id) and (select private.has_account())) with check(private.owns_profile(profile_id) and (select private.has_account()));

alter table public.movie_reviews add column profile_id uuid references public.profiles(id) on delete set null;
create index movie_reviews_profile_idx on public.movie_reviews(profile_id,created_at desc);
grant select on public.movie_reviews to anon;
drop policy reviews_read_community on public.movie_reviews;
create policy reviews_read_community on public.movie_reviews for select using(true);
create policy reviews_account_insert on public.movie_reviews as restrictive for insert to authenticated with check((select private.has_account()));
create policy reviews_account_update on public.movie_reviews as restrictive for update to authenticated using((select private.has_account())) with check((select private.has_account()));
create function private.review_author() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_account() then raise insufficient_privilege using message='Account required'; end if;
  insert into public.profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select id, display_name into new.profile_id, new.display_name from public.profiles where user_id=auth.uid();
  return new;
end;
$$;
revoke all on function private.review_author() from public, anon, authenticated;
create trigger review_author before insert or update on public.movie_reviews for each row execute function private.review_author();
grant execute on function public.movie_review_summary(bigint) to anon;
create policy votes_account_insert on public.review_votes as restrictive for insert to authenticated with check((select private.has_account()));
create policy votes_account_update on public.review_votes as restrictive for update to authenticated using((select private.has_account())) with check((select private.has_account()));
create or replace function private.review_vote_totals(p_review_ids uuid[])
returns table(review_id uuid,upvotes bigint,downvotes bigint,my_vote smallint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(cardinality(p_review_ids),0)>200 then raise invalid_parameter_value; end if;
  return query select r.id,count(v.user_id) filter(where v.value=1),count(v.user_id) filter(where v.value=-1),coalesce(max(v.value) filter(where v.user_id=auth.uid()),0)::smallint from public.movie_reviews r left join public.review_votes v on v.review_id=r.id where r.id=any(p_review_ids) group by r.id;
end;
$$;
grant usage on schema private to anon;
grant execute on function private.review_vote_totals(uuid[]) to anon;
grant execute on function public.movie_review_votes(uuid[]) to anon;

create function public.profile_reviews(p_handle text,p_offset integer default 0) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
    select w.title,w.year,w.poster_url,r.rating,r.comment,r.contains_spoilers,r.created_at,r.tmdb_id
    from public.movie_reviews r join public.profiles p on p.id=r.profile_id join public.watched_movies w on w.id=r.id
    where p.handle=p_handle and (p.user_id=auth.uid() or (p.is_public and p.show_reviews))
    order by r.created_at desc,r.id desc limit 20 offset greatest(0,least(p_offset,10000))
  ) r;
$$;
revoke all on function public.profile_reviews(text,integer) from public;
grant execute on function public.profile_reviews(text,integer) to anon,authenticated;

create table public.saved_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 80),
  saved_at timestamptz not null default now(),
  primary key(user_id,session_id)
);
create index saved_sessions_session_idx on public.saved_sessions(session_id);
alter table public.saved_sessions enable row level security;
revoke all on public.saved_sessions from anon,authenticated;
grant select,delete on public.saved_sessions to authenticated;
create policy saved_sessions_own on public.saved_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy saved_sessions_delete on public.saved_sessions for delete to authenticated using(user_id=(select auth.uid()) and (select private.has_account()));
create function private.saved_expiration() returns trigger language plpgsql security definer set search_path = '' as $$
declare room uuid := coalesce(new.session_id,old.session_id);
begin
  perform 1 from public.sessions where id=room for update;
  update public.sessions set expires_at=case when exists(select 1 from public.saved_sessions where session_id=room) then 'infinity'::timestamptz else now()+interval '24 hours' end where id=room;
  return null;
end;
$$;
revoke all on function private.saved_expiration() from public,anon,authenticated;
create trigger saved_expiration after insert or delete on public.saved_sessions for each row execute function private.saved_expiration();
create function public.save_session(p_session_id uuid,p_name text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_account() then raise insufficient_privilege using message='Account required'; end if;
  perform 1 from public.sessions s join public.session_members m on m.session_id=s.id where s.id=p_session_id and s.expires_at>now() and m.user_id=auth.uid() and m.left_at is null for update of s;
  if not found then raise insufficient_privilege using message='Active room membership required'; end if;
  insert into public.saved_sessions(user_id,session_id,name) values(auth.uid(),p_session_id,btrim(p_name)) on conflict(user_id,session_id) do update set name=excluded.name;
end;
$$;
create function public.my_saved_sessions() returns table(session_id uuid,code text,name text,saved_at timestamptz) language sql stable security definer set search_path = '' as $$
  select b.session_id,s.code,b.name,b.saved_at from public.saved_sessions b join public.sessions s on s.id=b.session_id where b.user_id=auth.uid() and private.has_account() order by b.saved_at desc;
$$;
revoke all on function public.save_session(uuid,text),public.my_saved_sessions() from public,anon;
grant execute on function public.save_session(uuid,text),public.my_saved_sessions() to authenticated;

-- Single-use proof of the visitor's identity. No caller can nominate an arbitrary source user.
create table private.guest_transfers(token uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id) on delete cascade,expires_at timestamptz not null default(now()+interval '24 hours'));
revoke all on private.guest_transfers from public,anon,authenticated;
create function public.prepare_guest_transfer() returns uuid language plpgsql security definer set search_path = '' as $$
declare ticket uuid;
begin
  if not exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then return null; end if;
  insert into private.guest_transfers(user_id) values(auth.uid()) on conflict(user_id) do update set token=gen_random_uuid(),expires_at=now()+interval '24 hours' returning token into ticket;
  return ticket;
end;
$$;
create function public.claim_guest_transfer(p_token uuid) returns void language plpgsql security definer set search_path = '' as $$
declare source uuid; caller uuid:=auth.uid();
begin
  if not private.has_account() then raise insufficient_privilege; end if;
  delete from private.guest_transfers t where token=p_token and expires_at>now() returning user_id into source;
  if source is null then raise invalid_parameter_value using message='Transfer expired or already used'; end if;
  if not exists(select 1 from auth.users where id=source and is_anonymous) then raise insufficient_privilege; end if;
  perform 1 from public.sessions where id in(select session_id from public.session_members where user_id=source) order by id for update;
  insert into public.session_members(session_id,user_id,last_seen_at,joined_at,left_at)
    select session_id,caller,last_seen_at,joined_at,left_at from public.session_members where user_id=source
    on conflict(session_id,user_id) do update set left_at=case when excluded.left_at is null then null else session_members.left_at end;
  insert into public.reactions(session_id,user_id,movie_id,value,created_at) select session_id,caller,movie_id,value,created_at from public.reactions where user_id=source on conflict(session_id,user_id,movie_id) do nothing;
  delete from public.reactions where user_id=source;
  delete from public.session_members where user_id=source;
  -- Preserve existing account choices on duplicate films; keep legacy public reviews intact.
  update public.watched_movies w set user_id=caller where user_id=source and not exists(select 1 from public.watched_movies a where a.user_id=caller and a.tmdb_id=w.tmdb_id);
  update public.movie_reviews r set display_name=r.display_name where r.profile_id is null and exists(select 1 from public.watched_movies w where w.id=r.id and w.user_id=caller);
end;
$$;
revoke all on function public.prepare_guest_transfer(),public.claim_guest_transfer(uuid) from public,anon;
grant execute on function public.prepare_guest_transfer(),public.claim_guest_transfer(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-media','profile-media',true,2097152,array['image/webp']);
create policy profile_media_read_own on storage.objects for select to authenticated using(bucket_id='profile-media' and exists(select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1] and private.owns_profile(p.id)));
create policy profile_media_insert on storage.objects for insert to authenticated with check(bucket_id='profile-media' and (select private.has_account()) and name ~ '^[a-f0-9-]+/(avatar|cover)-[a-f0-9-]+\.webp$' and exists(select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1] and private.owns_profile(p.id)));
create policy profile_media_delete on storage.objects for delete to authenticated using(bucket_id='profile-media' and exists(select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1] and private.owns_profile(p.id)));
