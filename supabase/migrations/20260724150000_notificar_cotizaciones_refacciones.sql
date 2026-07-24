alter table public.notificaciones_push alter column id_ticket drop not null;
alter table public.notificaciones_push drop constraint if exists notificaciones_push_id_ticket_key;
alter table public.notificaciones_push add column if not exists id_solicitud_refacciones bigint references public.solicitudes_refacciones(id_solicitud) on delete cascade;
alter table public.notificaciones_push add column if not exists id_usuario_destino uuid references auth.users(id) on delete cascade;
alter table public.notificaciones_push add column if not exists titulo text;
alter table public.notificaciones_push add column if not exists mensaje text;
alter table public.notificaciones_push add column if not exists url_destino text;

create or replace function public.encolar_notificacion_cotizacion_refacciones()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_usuario uuid; v_tienda text;
begin
  select m.id_usuario, tr.nombre_tienda into v_usuario, v_tienda
  from public.solicitudes_refacciones s join public.mecanicos m on m.id_mecanico = s.id_mecanico join public.tiendas_refacciones tr on tr.id_tienda = new.id_tienda
  where s.id_solicitud = new.id_solicitud;
  if v_usuario is not null and new.estatus = 'Pendiente' then
    insert into public.notificaciones_push (id_solicitud_refacciones, id_usuario_destino, titulo, mensaje, url_destino)
    values (new.id_solicitud, v_usuario, 'Nueva cotización de refacciones', coalesce(v_tienda, 'Una tienda') || ' envió una cotización para tu solicitud.', '/taller');
  end if;
  return new;
end;
$$;

drop trigger if exists ofertas_refacciones_encolar_notificacion on public.ofertas_refacciones;
create trigger ofertas_refacciones_encolar_notificacion after insert or update of precio_estimado, tiempo_estimado_minutos, mensaje on public.ofertas_refacciones
for each row execute function public.encolar_notificacion_cotizacion_refacciones();

create or replace function public.tokens_push_para_notificacion(p_id_notificacion bigint)
returns table (token_fcm text, titulo text, mensaje text, url_destino text)
language sql security definer set search_path = public as $$
  select s.token_fcm,
    coalesce(n.titulo, 'Nueva solicitud cerca de ti'),
    coalesce(n.mensaje, 'Un automovilista necesita asistencia dentro de tu radio.'),
    coalesce(n.url_destino, '/taller')
  from public.notificaciones_push n
  left join public.tickets t on t.id_ticket = n.id_ticket
  left join public.mecanicos m on m.estatus_suscripcion = 'Activo' and m.ubicacion is not null and t.ubicacion is not null and extensions.ST_DWithin(m.ubicacion, t.ubicacion, m.radio_cobertura_metros)
  join public.suscripciones_push s on s.id_usuario = coalesce(n.id_usuario_destino, m.id_usuario)
  where n.id_notificacion = p_id_notificacion;
$$;

revoke all on function public.tokens_push_para_notificacion(bigint) from public;
grant execute on function public.tokens_push_para_notificacion(bigint) to service_role;
