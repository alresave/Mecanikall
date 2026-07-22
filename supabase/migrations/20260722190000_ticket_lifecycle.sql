-- Ciclo operativo: cliente cancela solo tickets abiertos; taller concluye solo los propios.
create or replace function public.cancelar_ticket(p_id_ticket bigint) returns setof public.tickets language plpgsql security definer set search_path = public as $$
declare v_ticket public.tickets;
begin
  update public.tickets set estatus = 'Cancelado' where id_ticket = p_id_ticket and id_usuario_solicitante = auth.uid() and estatus = 'Abierto' returning * into v_ticket;
  if not found then raise exception 'La solicitud ya no se puede cancelar' using errcode = 'P0002'; end if;
  return next v_ticket;
end; $$;

create or replace function public.tickets_asignados_del_taller() returns table (id_ticket bigint, id_cliente bigint, descripcion_falla text, ubicacion_auto text, estatus public.tipo_estatus_ticket, id_mecanico_asignado bigint, created_at timestamptz, updated_at timestamptz, cliente jsonb) language sql security definer set search_path = public as $$
  select t.id_ticket, t.id_cliente, t.descripcion_falla, t.ubicacion_auto, t.estatus, t.id_mecanico_asignado, t.created_at, t.updated_at, jsonb_build_object('nombre_completo', c.nombre_completo, 'telefono_whatsapp', c.telefono_whatsapp) from public.tickets t join public.clientes c on c.id_cliente = t.id_cliente join public.mecanicos m on m.id_mecanico = t.id_mecanico_asignado where t.estatus = 'Asignado' and m.id_usuario = auth.uid() order by t.created_at desc;
$$;

create or replace function public.concluir_ticket(p_id_ticket bigint) returns setof public.tickets language plpgsql security definer set search_path = public as $$
declare v_ticket public.tickets;
begin
  update public.tickets set estatus = 'Concluido' where id_ticket = p_id_ticket and estatus = 'Asignado' and id_mecanico_asignado in (select id_mecanico from public.mecanicos where id_usuario = auth.uid() and estatus_suscripcion = 'Activo') returning * into v_ticket;
  if not found then raise exception 'El servicio no se puede concluir' using errcode = 'P0002'; end if;
  return next v_ticket;
end; $$;

revoke all on function public.cancelar_ticket(bigint) from public;
grant execute on function public.cancelar_ticket(bigint) to authenticated;
revoke all on function public.tickets_asignados_del_taller() from public;
grant execute on function public.tickets_asignados_del_taller() to authenticated;
revoke all on function public.concluir_ticket(bigint) from public;
grant execute on function public.concluir_ticket(bigint) to authenticated;
