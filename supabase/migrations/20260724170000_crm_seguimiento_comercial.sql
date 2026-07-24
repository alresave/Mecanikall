create table if not exists public.seguimientos_comerciales (
  tipo_entidad text not null check (tipo_entidad in ('Taller', 'Tienda de refacciones')),
  id_entidad bigint not null,
  estado text not null default 'Nuevo' check (estado in ('Nuevo', 'Contactado', 'Visita agendada', 'Interesado', 'Suscripción activa', 'Descartado')),
  id_responsable uuid references auth.users(id) on delete set null,
  proxima_accion date,
  notas text not null default '' check (char_length(notas) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tipo_entidad, id_entidad)
);
alter table public.seguimientos_comerciales enable row level security;
drop trigger if exists seguimientos_comerciales_updated_at on public.seguimientos_comerciales;
create trigger seguimientos_comerciales_updated_at before update on public.seguimientos_comerciales for each row execute function public.actualizar_updated_at();

create or replace function public.seguimientos_comerciales_actuales()
returns table (tipo_entidad text,id_entidad bigint,estado text,proxima_accion date,notas text,asignado_a_mi boolean)
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.administradores where id_usuario=auth.uid()) and not exists(select 1 from public.vendedores where id_usuario=auth.uid()) then raise exception 'No autorizado'; end if;
 return query select s.tipo_entidad,s.id_entidad,s.estado,s.proxima_accion,s.notas,s.id_responsable=auth.uid() from public.seguimientos_comerciales s;
end; $$;

create or replace function public.guardar_seguimiento_comercial(p_tipo_entidad text,p_id_entidad bigint,p_estado text,p_proxima_accion date default null,p_notas text default '',p_asignarme boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare v_es_admin boolean; v_responsable uuid;
begin
 v_es_admin:=exists(select 1 from public.administradores where id_usuario=auth.uid());
 if not v_es_admin and not exists(select 1 from public.vendedores where id_usuario=auth.uid()) then raise exception 'No autorizado'; end if;
 if p_tipo_entidad not in ('Taller','Tienda de refacciones') or p_estado not in ('Nuevo','Contactado','Visita agendada','Interesado','Suscripción activa','Descartado') then raise exception 'Datos inválidos'; end if;
 select id_responsable into v_responsable from public.seguimientos_comerciales where tipo_entidad=p_tipo_entidad and id_entidad=p_id_entidad;
 if v_responsable is not null and v_responsable<>auth.uid() and not v_es_admin then raise exception 'El seguimiento está asignado a otro usuario'; end if;
 insert into public.seguimientos_comerciales(tipo_entidad,id_entidad,estado,id_responsable,proxima_accion,notas)
 values(p_tipo_entidad,p_id_entidad,p_estado,case when p_asignarme or v_responsable is null then auth.uid() else v_responsable end,p_proxima_accion,trim(coalesce(p_notas,'')))
 on conflict(tipo_entidad,id_entidad) do update set estado=excluded.estado,proxima_accion=excluded.proxima_accion,notas=excluded.notas,id_responsable=case when p_asignarme then auth.uid() else seguimientos_comerciales.id_responsable end,updated_at=now();
end; $$;
revoke all on function public.seguimientos_comerciales_actuales(),public.guardar_seguimiento_comercial(text,bigint,text,date,text,boolean) from public;
grant execute on function public.seguimientos_comerciales_actuales(),public.guardar_seguimiento_comercial(text,bigint,text,date,text,boolean) to authenticated;
