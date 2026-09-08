-- Mantém public.users sincronizada com auth.users.
-- Isso garante que um usuário recém-autenticado possa participar
-- de uma sessão imediatamente.

create schema if not exists private;

revoke all on schema private from public;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all
on function private.handle_new_auth_user()
from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_auth_user();

-- Cria os perfis que faltam para usuários já existentes.
insert into public.users (id)
select id
from auth.users
on conflict (id) do nothing;

-- Garante integridade entre o perfil da aplicação e o usuário do Auth.
alter table public.users
  add constraint users_id_fkey
  foreign key (id)
  references auth.users(id)
  on delete cascade;