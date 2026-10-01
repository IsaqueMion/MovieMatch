-- Only administrator-selected demo rooms receive initial example likes.
create table private.demo_sessions (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  movie_ids bigint[] not null check (cardinality(movie_ids) between 1 and 20)
);
alter table private.demo_sessions enable row level security;
revoke all on private.demo_sessions from public, anon, authenticated;

create function private.seed_demo_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.left_at is null then
    insert into public.reactions (session_id, user_id, movie_id, value)
    select new.session_id, new.user_id, movie_id, 1
    from private.demo_sessions d join public.sessions s on s.id = d.session_id,
      lateral unnest(d.movie_ids) as movie_id
    where d.session_id = new.session_id and s.expires_at > now()
    on conflict (session_id, user_id, movie_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.seed_demo_member() from public, anon, authenticated;
create trigger seed_demo_member after insert on public.session_members
  for each row execute function private.seed_demo_member();

create function private.is_demo_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from public.session_members m where m.session_id = p_session_id and m.user_id = auth.uid() and m.left_at is null)
    and exists (select 1 from private.demo_sessions d where d.session_id = p_session_id);
$$;
revoke all on function private.is_demo_session(uuid) from public, anon;
grant execute on function private.is_demo_session(uuid) to authenticated;
create function public.is_demo_session(p_session_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_demo_session(p_session_id);
$$;
revoke all on function public.is_demo_session(uuid) from public, anon;
grant execute on function public.is_demo_session(uuid) to authenticated;
