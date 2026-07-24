create table if not exists public.suscripciones_comerciales (
  tipo_entidad text not null check (tipo_entidad in ('Taller','Tienda de refacciones')),
  id_entidad bigint not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  estado text not null default 'inactiva' check (estado in ('inactiva','trialing','active','past_due','canceled','unpaid')),
  periodo_actual_fin timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (tipo_entidad,id_entidad)
);
alter table public.suscripciones_comerciales enable row level security;
drop trigger if exists suscripciones_comerciales_updated_at on public.suscripciones_comerciales;
create trigger suscripciones_comerciales_updated_at before update on public.suscripciones_comerciales for each row execute function public.actualizar_updated_at();

create or replace function public.mi_elegibilidad_suscripcion()
returns table(tipo_entidad text,id_entidad bigint,atenciones_mes integer,estado text,periodo_actual_fin timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_mecanico bigint;v_tienda bigint;v_atenciones integer;
begin
 select id_mecanico into v_mecanico from public.mecanicos where id_usuario=auth.uid();
 if v_mecanico is not null then select count(*)::integer into v_atenciones from public.tickets where id_mecanico_asignado=v_mecanico and estatus='Concluido' and updated_at>=date_trunc('month',now()); return query select 'Taller'::text,v_mecanico,v_atenciones,coalesce(s.estado,'inactiva'),s.periodo_actual_fin from public.suscripciones_comerciales s where s.tipo_entidad='Taller' and s.id_entidad=v_mecanico; if not found then return query select 'Taller'::text,v_mecanico,v_atenciones,'inactiva'::text,null::timestamptz; end if; return; end if;
 select id_tienda into v_tienda from public.tiendas_refacciones where id_usuario=auth.uid();
 if v_tienda is not null then select count(*)::integer into v_atenciones from public.solicitudes_refacciones where id_tienda_asignada=v_tienda and estatus='Aceptada' and accepted_at>=date_trunc('month',now()); return query select 'Tienda de refacciones'::text,v_tienda,v_atenciones,coalesce(s.estado,'inactiva'),s.periodo_actual_fin from public.suscripciones_comerciales s where s.tipo_entidad='Tienda de refacciones' and s.id_entidad=v_tienda; if not found then return query select 'Tienda de refacciones'::text,v_tienda,v_atenciones,'inactiva'::text,null::timestamptz; end if; return; end if;
 raise exception 'Cuenta sin entidad comercial';
end; $$;
revoke all on function public.mi_elegibilidad_suscripcion() from public; grant execute on function public.mi_elegibilidad_suscripcion() to authenticated;
