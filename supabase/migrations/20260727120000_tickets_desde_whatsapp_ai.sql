-- Conserva el contexto del pre-diagnóstico para que el taller reciba una solicitud útil.
alter table public.tickets
  add column if not exists canal_origen text not null default 'Web'
    check (canal_origen in ('Web', 'WhatsApp')),
  add column if not exists ai_sesion_id text,
  add column if not exists ai_prediagnostico jsonb,
  add column if not exists ai_urgencia text
    check (ai_urgencia is null or ai_urgencia in ('low', 'medium', 'high'));

create unique index if not exists tickets_ai_sesion_unica_idx
  on public.tickets (ai_sesion_id)
  where ai_sesion_id is not null;

-- Solo la Edge Function, autenticada con service_role, puede invocar esta RPC.
create or replace function public.registrar_ticket_desde_whatsapp(
  p_sesion_ai text,
  p_nombre text,
  p_telefono text,
  p_ubicacion text,
  p_latitud double precision,
  p_longitud double precision,
  p_descripcion text,
  p_prediagnostico jsonb,
  p_urgencia text
)
returns setof public.tickets
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cliente bigint;
  v_ticket public.tickets;
begin
  if coalesce(length(trim(p_sesion_ai)), 0) < 8 then raise exception 'Sesión de IA inválida'; end if;
  if trim(p_telefono) !~ '^[0-9]{10}$' then raise exception 'Teléfono inválido'; end if;
  if coalesce(length(trim(p_nombre)), 0) < 2 then raise exception 'Nombre inválido'; end if;
  if coalesce(length(trim(p_ubicacion)), 0) < 3 then raise exception 'Ubicación inválida'; end if;
  if p_latitud is null or p_longitud is null or p_latitud not between -90 and 90 or p_longitud not between -180 and 180 then raise exception 'Coordenadas inválidas'; end if;
  if coalesce(length(trim(p_descripcion)), 0) < 10 then raise exception 'Descripción inválida'; end if;
  if p_urgencia is not null and p_urgencia not in ('low', 'medium', 'high') then raise exception 'Urgencia inválida'; end if;

  select * into v_ticket from public.tickets where ai_sesion_id = trim(p_sesion_ai);
  if found then return next v_ticket; return; end if;

  insert into public.clientes (nombre_completo, telefono_whatsapp)
  values (trim(p_nombre), trim(p_telefono))
  on conflict (telefono_whatsapp) do update set nombre_completo = excluded.nombre_completo
  returning id_cliente into v_cliente;

  insert into public.tickets (
    id_cliente, ubicacion_auto, ubicacion, descripcion_falla, canal_origen,
    ai_sesion_id, ai_prediagnostico, ai_urgencia
  ) values (
    v_cliente, trim(p_ubicacion),
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitud, p_latitud), 4326)::extensions.geography,
    trim(p_descripcion), 'WhatsApp', trim(p_sesion_ai), p_prediagnostico, p_urgencia
  ) returning * into v_ticket;

  return next v_ticket;
end;
$$;

revoke all on function public.registrar_ticket_desde_whatsapp(text, text, text, text, double precision, double precision, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_ticket_desde_whatsapp(text, text, text, text, double precision, double precision, text, jsonb, text) to service_role;
