create or replace function public.entidades_operativas()
returns table (tipo text, id_entidad bigint, nombre text, whatsapp text, zona text, estatus text, created_at timestamptz, atenciones_mes integer)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.administradores where id_usuario = auth.uid()) and not exists (select 1 from public.vendedores where id_usuario = auth.uid()) then raise exception 'No autorizado'; end if;
  return query
  select 'Taller'::text,m.id_mecanico,m.nombre_taller,m.whatsapp_destino,m.zona_cobertura,m.estatus_suscripcion,m.created_at,count(t.id_ticket) filter (where t.estatus='Concluido' and t.updated_at>=date_trunc('month',now()))::integer from public.mecanicos m left join public.tickets t on t.id_mecanico_asignado=m.id_mecanico group by m.id_mecanico
  union all
  select 'Tienda'::text,tr.id_tienda,tr.nombre_tienda,tr.whatsapp_destino,tr.zona_cobertura,tr.estatus,tr.created_at,count(s.id_solicitud) filter (where s.estatus='Aceptada' and s.accepted_at>=date_trunc('month',now()))::integer from public.tiendas_refacciones tr left join public.solicitudes_refacciones s on s.id_tienda_asignada=tr.id_tienda group by tr.id_tienda
  order by 7 desc, 1, 3;
end; $$;
create or replace function public.actualizar_estatus_entidad(p_tipo text,p_id_entidad bigint,p_estatus text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.administradores where id_usuario=auth.uid()) then raise exception 'Solo administradores'; end if;
  if p_estatus not in ('Activo','Suspendido','Pendiente') then raise exception 'Estatus inválido'; end if;
  if p_tipo='Taller' then update public.mecanicos set estatus_suscripcion=p_estatus where id_mecanico=p_id_entidad; elsif p_tipo='Tienda' then update public.tiendas_refacciones set estatus=p_estatus where id_tienda=p_id_entidad; else raise exception 'Tipo inválido'; end if;
  if not found then raise exception 'Entidad no encontrada'; end if;
end; $$;
revoke all on function public.entidades_operativas(),public.actualizar_estatus_entidad(text,bigint,text) from public;
grant execute on function public.entidades_operativas(),public.actualizar_estatus_entidad(text,bigint,text) to authenticated;
