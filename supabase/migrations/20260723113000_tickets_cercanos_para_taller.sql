-- El panel de cada taller solo puede consultar tickets abiertos dentro de su radio.
drop function if exists public.tickets_abiertos_para_taller();

create function public.tickets_abiertos_para_taller(
  p_radio_metros double precision default 5000
)
returns table (
  id_ticket bigint,
  id_cliente bigint,
  descripcion_falla text,
  ubicacion_auto text,
  estatus public.tipo_estatus_ticket,
  id_mecanico_asignado bigint,
  created_at timestamptz,
  updated_at timestamptz,
  cliente jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  if p_radio_metros is null or p_radio_metros <= 0 or p_radio_metros > 50000 then
    raise exception 'El radio debe estar entre 0 y 50000 metros';
  end if;

  return query
  select t.id_ticket, t.id_cliente, t.descripcion_falla, t.ubicacion_auto,
    t.estatus, t.id_mecanico_asignado, t.created_at, t.updated_at,
    jsonb_build_object('nombre_completo', c.nombre_completo, 'telefono_whatsapp', c.telefono_whatsapp)
  from public.mecanicos m
  join public.tickets t on t.estatus = 'Abierto'
    and t.ubicacion is not null
    and extensions.ST_DWithin(m.ubicacion, t.ubicacion, p_radio_metros)
  join public.clientes c on c.id_cliente = t.id_cliente
  where m.id_usuario = auth.uid()
    and m.estatus_suscripcion = 'Activo'
    and m.ubicacion is not null
  order by t.created_at asc;
end;
$$;

revoke all on function public.tickets_abiertos_para_taller(double precision) from public;
grant execute on function public.tickets_abiertos_para_taller(double precision) to authenticated;
