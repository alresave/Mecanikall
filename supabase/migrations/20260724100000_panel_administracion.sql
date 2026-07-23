create table if not exists public.administradores (
  id_usuario uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.administradores enable row level security;

create or replace function public.es_administrador()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.administradores where id_usuario = auth.uid());
$$;
revoke all on function public.es_administrador() from public;
grant execute on function public.es_administrador() to authenticated;
