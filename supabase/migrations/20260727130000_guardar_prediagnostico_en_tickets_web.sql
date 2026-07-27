-- El formulario web obtiene el pre-diagnóstico antes de abrir la solicitud.
-- Conservamos tanto el informe visible para el taller como el dato estructurado.
drop function if exists public.solicitar_ayuda(text, text, text, text, double precision, double precision);

create or replace function public.solicitar_ayuda(
  p_nombre text,
  p_telefono text,
  p_ubicacion text,
  p_descripcion text,
  p_latitud double precision,
  p_longitud double precision,
  p_prediagnostico jsonb default null,
  p_urgencia text default null
)
returns setof public.tickets
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_cliente bigint; v_ticket public.tickets;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  if trim(p_telefono) !~ '^[0-9]{10}$' then raise exception 'Teléfono inválido'; end if;
  if coalesce(length(trim(p_nombre)), 0) < 2 then raise exception 'Nombre inválido'; end if;
  if coalesce(length(trim(p_ubicacion)), 0) < 3 then raise exception 'Ubicación inválida'; end if;
  if coalesce(length(trim(p_descripcion)), 0) < 10 then raise exception 'Descripción inválida'; end if;
  if p_latitud is null or p_latitud not between -90 and 90 then raise exception 'Latitud inválida'; end if;
  if p_longitud is null or p_longitud not between -180 and 180 then raise exception 'Longitud inválida'; end if;
  if p_urgencia is not null and p_urgencia not in ('low', 'medium', 'high') then raise exception 'Urgencia inválida'; end if;

  insert into public.clientes (nombre_completo, telefono_whatsapp)
  values (trim(p_nombre), trim(p_telefono))
  on conflict (telefono_whatsapp) do update set nombre_completo = excluded.nombre_completo
  returning id_cliente into v_cliente;

  insert into public.tickets (id_cliente, id_usuario_solicitante, ubicacion_auto, ubicacion, descripcion_falla, canal_origen, ai_prediagnostico, ai_urgencia)
  values (v_cliente, auth.uid(), trim(p_ubicacion), extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitud, p_latitud), 4326)::extensions.geography, trim(p_descripcion), 'Web', p_prediagnostico, p_urgencia)
  returning * into v_ticket;
  return next v_ticket;
end;
$$;

revoke all on function public.solicitar_ayuda(text, text, text, text, double precision, double precision, jsonb, text) from public;
grant execute on function public.solicitar_ayuda(text, text, text, text, double precision, double precision, jsonb, text) to authenticated;
