create or replace function public.prospectos_suscripcion_mensual(p_mes date default current_date)
returns table (tipo text, id_entidad bigint, nombre text, whatsapp text, zona_cobertura text, atenciones integer)
language plpgsql security definer set search_path = public as $$
declare v_inicio date := date_trunc('month', p_mes)::date; v_fin date := (date_trunc('month', p_mes) + interval '1 month')::date;
begin
  if not exists (select 1 from public.administradores where id_usuario = auth.uid()) and not exists (select 1 from public.vendedores where id_usuario = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  return query
  select 'Taller'::text, m.id_mecanico, m.nombre_taller, m.whatsapp_destino, m.zona_cobertura, count(t.id_ticket)::integer
  from public.mecanicos m join public.tickets t on t.id_mecanico_asignado = m.id_mecanico
  where t.estatus = 'Concluido' and t.updated_at >= v_inicio and t.updated_at < v_fin
  group by m.id_mecanico, m.nombre_taller, m.whatsapp_destino, m.zona_cobertura
  having count(t.id_ticket) >= 10
  union all
  select 'Tienda de refacciones'::text, tr.id_tienda, tr.nombre_tienda, tr.whatsapp_destino, tr.zona_cobertura, count(s.id_solicitud)::integer
  from public.tiendas_refacciones tr join public.solicitudes_refacciones s on s.id_tienda_asignada = tr.id_tienda
  where s.estatus = 'Aceptada' and s.accepted_at >= v_inicio and s.accepted_at < v_fin
  group by tr.id_tienda, tr.nombre_tienda, tr.whatsapp_destino, tr.zona_cobertura
  having count(s.id_solicitud) >= 10
  order by 6 desc, 1, 3;
end;
$$;

revoke all on function public.prospectos_suscripcion_mensual(date) from public;
grant execute on function public.prospectos_suscripcion_mensual(date) to authenticated;
