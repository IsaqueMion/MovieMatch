alter table public.session_members
add column if not exists last_seen_at timestamptz;

-- Os membros históricos não devem ser considerados
-- online logo após a migration.
update public.session_members
set last_seen_at = '1970-01-01 00:00:00+00'
where last_seen_at is null;

alter table public.session_members
alter column last_seen_at set default now();

alter table public.session_members
alter column last_seen_at set not null;

create index if not exists
  session_members_session_last_seen_idx
on public.session_members (
  session_id,
  last_seen_at desc
);


-- =====================================================
-- HEARTBEAT / CONTAGEM ONLINE
-- =====================================================

create or replace function public.touch_session_presence(
  p_session_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_online_count bigint;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.session_members
  set last_seen_at = now()
  where session_id = p_session_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Usuário não pertence à sessão';
  end if;

  select count(*)
  into v_online_count
  from public.session_members
  where session_id = p_session_id
    and last_seen_at >=
      now() - interval '90 seconds';

  return v_online_count;
end;
$$;

revoke all
on function public.touch_session_presence(uuid)
from public;

grant execute
on function public.touch_session_presence(uuid)
to authenticated;


-- =====================================================
-- JOIN
-- Atualiza a atividade sempre que o usuário entra.
-- =====================================================

create or replace function public.join_session(
  p_code text
)
returns table(
  id uuid,
  code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text :=
    upper(trim(coalesce(p_code, '')));
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Invalid session code'
      using errcode = '22023';
  end if;

  select s.id
  into v_session_id
  from public.sessions as s
  where s.code = v_code
  limit 1;

  if v_session_id is null then
    raise exception 'Session not found'
      using errcode = 'P0002';
  end if;

  insert into public.session_members (
    session_id,
    user_id,
    last_seen_at
  )
  values (
    v_session_id,
    v_user_id,
    now()
  )
  on conflict (session_id, user_id)
  do update
  set last_seen_at = now();

  return query
  select v_session_id, v_code;
end;
$$;


-- =====================================================
-- MATCH
-- Somente participantes ativos contam.
-- =====================================================

create or replace function public.check_session_match(
  p_session_id uuid,
  p_movie_id bigint
)
returns table(
  is_match boolean,
  member_count bigint,
  like_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_member_count bigint;
  v_like_count bigint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.session_members
    where session_id = p_session_id
      and user_id = v_user_id
  ) then
    raise exception 'Usuário não pertence à sessão';
  end if;

  select count(*)
  into v_member_count
  from public.session_members
  where session_id = p_session_id
    and last_seen_at >=
      now() - interval '90 seconds';

  select count(distinct r.user_id)
  into v_like_count
  from public.reactions r
  inner join public.session_members sm
    on sm.session_id = r.session_id
   and sm.user_id = r.user_id
  where r.session_id = p_session_id
    and r.movie_id = p_movie_id
    and r.value = 1
    and sm.last_seen_at >=
      now() - interval '90 seconds';

  return query
  select
    v_member_count >= 2
      and v_like_count = v_member_count,
    v_member_count,
    v_like_count;
end;
$$;


-- =====================================================
-- LISTA DE MATCHES
-- Mesma regra dos participantes ativos.
-- =====================================================

create or replace function public.list_session_matches(
  p_session_id uuid
)
returns table(
  movie_id bigint,
  tmdb_id bigint,
  title text,
  year integer,
  poster_url text,
  likes bigint,
  member_count bigint,
  latest_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_member_count bigint;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.session_members
    where session_id = p_session_id
      and user_id = v_user_id
  ) then
    raise exception 'Usuário não pertence à sessão';
  end if;

  select count(*)
  into v_member_count
  from public.session_members
  where session_id = p_session_id
    and last_seen_at >=
      now() - interval '90 seconds';

  if v_member_count < 2 then
    return;
  end if;

  return query
  select
    m.id,
    m.tmdb_id,
    m.title,
    m.year,
    m.poster_url,

    count(distinct sm.user_id)::bigint,

    v_member_count,

    max(r.created_at)

  from public.reactions r

  inner join public.session_members sm
    on sm.session_id = p_session_id
   and sm.user_id = r.user_id
   and sm.last_seen_at >=
     now() - interval '90 seconds'

  inner join public.movies m
    on m.id = r.movie_id

  where r.session_id = p_session_id
    and r.value = 1

  group by
    m.id,
    m.tmdb_id,
    m.title,
    m.year,
    m.poster_url

  having
    count(distinct sm.user_id) =
      v_member_count

  order by
    max(r.created_at) desc,
    m.title asc;
end;
$$;
