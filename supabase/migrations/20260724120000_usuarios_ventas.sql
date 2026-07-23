create table if not exists public.vendedores (
  id_usuario uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.vendedores enable row level security;

create or replace function public.mi_rol_backoffice()
returns text language sql security definer set search_path = public as $$
  select case when exists (select 1 from public.administradores where id_usuario = auth.uid()) then 'admin'
    when exists (select 1 from public.vendedores where id_usuario = auth.uid()) then 'ventas' else null end;
$$;
revoke all on function public.mi_rol_backoffice() from public;
grant execute on function public.mi_rol_backoffice() to authenticated;
