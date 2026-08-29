-- Embudo mensual para que administración mida la conversión del servicio.
create or replace function public.reporte_conversion_mensual(p_mes date default date_trunc('month', now())::date)
returns table (solicitudes integer, solicitudes_con_oferta integer, ofertas_aceptadas integer, servicios_concluidos integer, suscripciones_activas integer)
language plpgsql security definer set search_path = public as $$
declare v_inicio timestamptz := date_trunc('month', p_mes::timestamptz); v_fin timestamptz := v_inicio + interval '1 month';
begin
  if not exists (select 1 from public.administradores where id_usuario = auth.uid()) then raise exception 'Solo administradores'; end if;
  return query select count(*)::integer, count(*) filter (where exists (select 1 from public.ofertas_ticket o where o.id_ticket = t.id_ticket))::integer, count(*) filter (where t.estatus in ('Asignado', 'Concluido'))::integer, count(*) filter (where t.estatus = 'Concluido')::integer, (select count(*)::integer from public.suscripciones_comerciales s where s.estado in ('trialing', 'active') and s.updated_at < v_fin)::integer from public.tickets t where t.created_at >= v_inicio and t.created_at < v_fin;
end;
$$;
revoke all on function public.reporte_conversion_mensual(date) from public;
grant execute on function public.reporte_conversion_mensual(date) to authenticated;
