-- MovieMatch - ciclo de vida de sessão e participantes estáveis.
--
-- Presença (online) continua baseada em last_seen_at.
-- Participação em match passa a usar left_at, sem remover alguém
-- da votação apenas porque o navegador ficou em segundo plano.

alter table public.sessions
  add column if not exists created_at timestamptz,
  add column if not exists expires_at timestamptz;

update public.sessions
set created_at = now()
where created_at is null;

update public.sessions
set expires_at = now() + interval '24 hours'
where expires_at is null;

alter table public.sessions
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

create index if not exists sessions_expires_at_idx
  on public.sessions(expires_at);


alter table public.session_members
  add column if not exists joined_at timestamptz,
  add column if not exists left_at timestamptz;

update public.session_members
set joined_at = case
  when last_seen_at <= '1971-01-01 00:00:00+00'::timestamptz
    then now()
  else last_seen_at
end
where joined_at is null;

-- Remove da composição atual somente associações realmente antigas.
-- A migration anterior marcou membros históricos com epoch; o corte
-- de 24h também elimina associações abandonadas desde então.
update public.session_members
set left_at = now()
where left_at is null
  and (
    last_seen_at <= '1971-01-01 00:00:00+00'::timestamptz
    or last_seen_at < now() - interval '24 hours'
  );

alter table public.session_members
  alter column joined_at set default now(),
  alter column joined_at set not null;

create index if not exists session_members_active_session_idx
  on public.session_members(session_id, user_id)
  where left_at is null;


-- =====================================================
-- CRIAR SESSÃO
-- =====================================================

create or replace function public.create_session()
returns table (
  id uuid,
  code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  loop
    v_code := '';

    for i in 1..6 loop
      v_code := v_code || substr(
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + (
          get_byte(
            extensions.gen_random_bytes(1),
            0
          ) % 32
        ),
        1
      );
    end loop;

    begin
      insert into public.sessions (
        code,
        created_at,
        expires_at
      )
      values (
        v_code,
        now(),
        now() + interval '24 hours'
      )
      returning sessions.id
      into v_session_id;

      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  insert into public.session_members (
    session_id,
    user_id,
    joined_at,
    last_seen_at,
    left_at
  )
  values (
    v_session_id,
    v_user_id,
    now(),
    now(),
    null
  )
  on conflict (session_id, user_id)
  do update
  set
    joined_at = now(),
    last_seen_at = now(),
    left_at = null;

  return query
  select v_session_id, v_code;
end;
$$;


-- =====================================================
-- ENTRAR / REENTRAR EM SESSÃO
-- =====================================================

create or replace function public.join_session(
  p_code text
)
returns table (
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
    and s.expires_at > now()
  limit 1;

  if v_session_id is null then
    raise exception 'Session not found or expired'
      using errcode = 'P0002';
  end if;

  insert into public.session_members (
    session_id,
    user_id,
    joined_at,
    last_seen_at,
    left_at
  )
  values (
    v_session_id,
    v_user_id,
    now(),
    now(),
    null
  )
  on conflict (session_id, user_id)
  do update
  set
    joined_at = case
      when session_members.left_at is not null
        then now()
      else session_members.joined_at
    end,
    last_seen_at = now(),
    left_at = null;

  return query
  select v_session_id, v_code;
end;
$$;


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

  update public.session_members as sm
  set last_seen_at = now()
  where sm.session_id = p_session_id
    and sm.user_id = v_user_id
    and sm.left_at is null
    and exists (
      select 1
      from public.sessions as s
      where s.id = p_session_id
        and s.expires_at > now()
    );

  if not found then
    raise exception 'Sessão expirada ou usuário não pertence à sessão';
  end if;

  select count(*)
  into v_online_count
  from public.session_members as sm
  inner join public.sessions as s
    on s.id = sm.session_id
  where sm.session_id = p_session_id
    and sm.left_at is null
    and sm.last_seen_at >=
      now() - interval '90 seconds'
    and s.expires_at > now();

  return v_online_count;
end;
$$;


-- =====================================================
-- MATCH
-- Participantes são membros atuais da sessão, não apenas online.
-- =====================================================

create or replace function public.check_session_match(
  p_session_id uuid,
  p_movie_id bigint
)
returns table (
  is_match boolean,
  member_count bigint,
  like_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_count bigint;
  v_like_count bigint;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.session_id = p_session_id
      and sm.user_id = v_user_id
      and sm.left_at is null
      and s.expires_at > now()
  ) then
    raise exception 'Sessão expirada ou usuário não pertence à sessão';
  end if;

  select count(*)
  into v_member_count
  from public.session_members
  where session_id = p_session_id
    and left_at is null;

  select count(distinct r.user_id)
  into v_like_count
  from public.reactions as r
  inner join public.session_members as sm
    on sm.session_id = r.session_id
   and sm.user_id = r.user_id
  where r.session_id = p_session_id
    and r.movie_id = p_movie_id
    and r.value = 1
    and sm.left_at is null;

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
-- Usa a mesma composição estável de participantes.
-- =====================================================

create or replace function public.list_session_matches(
  p_session_id uuid
)
returns table (
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
  v_user_id uuid := auth.uid();
  v_member_count bigint;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.session_id = p_session_id
      and sm.user_id = v_user_id
      and sm.left_at is null
      and s.expires_at > now()
  ) then
    raise exception 'Sessão expirada ou usuário não pertence à sessão';
  end if;

  select count(*)
  into v_member_count
  from public.session_members
  where session_id = p_session_id
    and left_at is null;

  if v_member_count < 2 then
    return;
  end if;

  return query
  select
    m.id as movie_id,
    m.tmdb_id,
    m.title,
    m.year,
    m.poster_url,
    count(distinct sm.user_id)::bigint as likes,
    v_member_count as member_count,
    max(r.created_at) as latest_at
  from public.reactions as r
  inner join public.session_members as sm
    on sm.session_id = p_session_id
   and sm.user_id = r.user_id
   and sm.left_at is null
  inner join public.movies as m
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


-- =====================================================
-- RLS: somente participantes atuais de sessões válidas.
-- =====================================================

drop policy if exists "sessions_select_member"
  on public.sessions;

create policy "sessions_select_member"
on public.sessions
for select
to authenticated
using (
  expires_at > now()
  and id in (
    select sm.session_id
    from public.session_members as sm
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
  )
);


drop policy if exists "reactions_select_session_member"
  on public.reactions;
drop policy if exists "reactions_insert_self"
  on public.reactions;
drop policy if exists "reactions_update_self"
  on public.reactions;
drop policy if exists "reactions_delete_self"
  on public.reactions;

create policy "reactions_select_session_member"
on public.reactions
for select
to authenticated
using (
  session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);

create policy "reactions_insert_self"
on public.reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);

create policy "reactions_update_self"
on public.reactions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
)
with check (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);

create policy "reactions_delete_self"
on public.reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);


drop policy if exists "session_filters_select_member"
  on public.session_filters;
drop policy if exists "session_filters_insert_member"
  on public.session_filters;
drop policy if exists "session_filters_update_member"
  on public.session_filters;

create policy "session_filters_select_member"
on public.session_filters
for select
to authenticated
using (
  session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);

create policy "session_filters_insert_member"
on public.session_filters
for insert
to authenticated
with check (
  updated_by = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);

create policy "session_filters_update_member"
on public.session_filters
for update
to authenticated
using (
  session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
)
with check (
  updated_by = (select auth.uid())
  and session_id in (
    select sm.session_id
    from public.session_members as sm
    inner join public.sessions as s
      on s.id = sm.session_id
    where sm.user_id = (select auth.uid())
      and sm.left_at is null
      and s.expires_at > now()
  )
);


revoke all
on function public.create_session()
from public, anon, authenticated;

revoke all
on function public.join_session(text)
from public, anon, authenticated;

revoke all
on function public.touch_session_presence(uuid)
from public, anon, authenticated;

revoke all
on function public.check_session_match(uuid, bigint)
from public, anon, authenticated;

revoke all
on function public.list_session_matches(uuid)
from public, anon, authenticated;

grant execute
on function public.create_session()
to authenticated;

grant execute
on function public.join_session(text)
to authenticated;

grant execute
on function public.touch_session_presence(uuid)
to authenticated;

grant execute
on function public.check_session_match(uuid, bigint)
to authenticated;

grant execute
on function public.list_session_matches(uuid)
to authenticated;
