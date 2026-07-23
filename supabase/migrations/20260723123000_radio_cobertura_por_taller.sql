-- Radio de operación configurable por cada taller (en metros).
alter table public.mecanicos add column if not exists radio_cobertura_metros integer not null default 5000
  check (radio_cobertura_metros in (3000, 5000, 10000, 20000));

-- El radio proviene exclusivamente del perfil del taller, no del navegador.
drop function if exists public.tickets_abiertos_para_taller(double precision);
create function public.tickets_abiertos_para_taller()
returns table (id_ticket bigint, id_cliente bigint, descripcion_falla text, ubicacion_auto text, estatus public.tipo_estatus_ticket, id_mecanico_asignado bigint, created_at timestamptz, updated_at timestamptz, cliente jsonb)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  return query select t.id_ticket, t.id_cliente, t.descripcion_falla, t.ubicacion_auto, t.estatus,
    t.id_mecanico_asignado, t.created_at, t.updated_at, null::jsonb
  from public.mecanicos m join public.tickets t on t.estatus = 'Abierto' and t.ubicacion is not null
    and extensions.ST_DWithin(m.ubicacion, t.ubicacion, m.radio_cobertura_metros)
  where m.id_usuario = auth.uid() and m.estatus_suscripcion = 'Activo' and m.ubicacion is not null
  order by t.created_at asc;
end;
$$;

create or replace function public.enviar_oferta(p_id_ticket bigint, p_precio_estimado numeric, p_tiempo_estimado_minutos integer, p_mensaje text default null)
returns setof public.ofertas_ticket language plpgsql security definer set search_path = public, extensions as $$
declare v_mecanico bigint; v_oferta public.ofertas_ticket;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  if p_precio_estimado is null or p_precio_estimado < 0 then raise exception 'Precio inválido'; end if;
  if p_tiempo_estimado_minutos is null or p_tiempo_estimado_minutos not between 1 and 1440 then raise exception 'Tiempo estimado inválido'; end if;
  if char_length(coalesce(p_mensaje, '')) > 500 then raise exception 'El mensaje excede 500 caracteres'; end if;
  select m.id_mecanico into v_mecanico from public.mecanicos m where m.id_usuario = auth.uid() and m.estatus_suscripcion = 'Activo';
  if v_mecanico is null then raise exception 'Taller no autorizado'; end if;
  if not exists (select 1 from public.tickets t join public.mecanicos m on m.id_mecanico = v_mecanico
    where t.id_ticket = p_id_ticket and t.estatus = 'Abierto' and t.ubicacion is not null and m.ubicacion is not null
      and extensions.ST_DWithin(m.ubicacion, t.ubicacion, m.radio_cobertura_metros)) then raise exception 'La solicitud ya no está disponible en tu radio'; end if;
  insert into public.ofertas_ticket (id_ticket, id_mecanico, precio_estimado, tiempo_estimado_minutos, mensaje)
  values (p_id_ticket, v_mecanico, p_precio_estimado, p_tiempo_estimado_minutos, nullif(trim(p_mensaje), ''))
  on conflict (id_ticket, id_mecanico) do update set precio_estimado = excluded.precio_estimado,
    tiempo_estimado_minutos = excluded.tiempo_estimado_minutos, mensaje = excluded.mensaje,
    estatus = 'Pendiente', updated_at = now() where ofertas_ticket.estatus = 'Pendiente'
  returning * into v_oferta;
  if v_oferta is null then raise exception 'Esta oferta ya no se puede modificar'; end if;
  return next v_oferta;
end;
$$;

create or replace function public.actualizar_radio_cobertura_mecanico(p_radio_metros integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  if p_radio_metros not in (3000, 5000, 10000, 20000) then raise exception 'Radio de cobertura inválido'; end if;
  update public.mecanicos set radio_cobertura_metros = p_radio_metros where id_usuario = auth.uid() and estatus_suscripcion = 'Activo';
  if not found then raise exception 'Taller activo no encontrado'; end if;
end;
$$;

revoke all on function public.tickets_abiertos_para_taller() from public;
grant execute on function public.tickets_abiertos_para_taller() to authenticated;
revoke all on function public.actualizar_radio_cobertura_mecanico(integer) from public;
grant execute on function public.actualizar_radio_cobertura_mecanico(integer) to authenticated;
