create or replace function public.solicitar_ayuda(
  p_nombre text, p_telefono text, p_ubicacion text, p_descripcion text,
  p_latitud double precision, p_longitud double precision
)
returns setof public.tickets language plpgsql security definer set search_path = public, extensions as $$
declare v_cliente bigint; v_ticket public.tickets;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  if p_telefono !~ '^[0-9]{10}$' then raise exception 'Teléfono inválido'; end if;
  if p_latitud is null or p_latitud not between -90 and 90 then raise exception 'Latitud inválida'; end if;
  if p_longitud is null or p_longitud not between -180 and 180 then raise exception 'Longitud inválida'; end if;

  -- Serializa altas del mismo teléfono sin depender de ON CONFLICT ni de un índice previo.
  perform pg_advisory_xact_lock(hashtext(p_telefono));
  select id_cliente into v_cliente from public.clientes where telefono_whatsapp = p_telefono order by id_cliente limit 1;
  if v_cliente is null then
    insert into public.clientes (nombre_completo, telefono_whatsapp) values (trim(p_nombre), p_telefono) returning id_cliente into v_cliente;
  else
    update public.clientes set nombre_completo = trim(p_nombre) where id_cliente = v_cliente;
  end if;

  insert into public.tickets (id_cliente, id_usuario_solicitante, ubicacion_auto, ubicacion, descripcion_falla)
  values (v_cliente, auth.uid(), trim(p_ubicacion), extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitud, p_latitud),4326)::extensions.geography, trim(p_descripcion))
  returning * into v_ticket;
  return next v_ticket;
end;
$$;

revoke all on function public.solicitar_ayuda(text,text,text,text,double precision,double precision) from public;
grant execute on function public.solicitar_ayuda(text,text,text,text,double precision,double precision) to authenticated;
