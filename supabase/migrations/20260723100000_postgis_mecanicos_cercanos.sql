-- Geolocalización nativa para Mecanikall.
-- PostGIS se instala en el esquema `extensions` de Supabase; se usan nombres
-- calificados para no depender del search_path de cada cliente.
create extension if not exists postgis with schema extensions;

alter table public.mecanicos
  add column if not exists ubicacion extensions.geography(Point, 4326);

alter table public.tickets
  add column if not exists ubicacion extensions.geography(Point, 4326);

-- Incluye únicamente filas con coordenadas, que son las que puede usar la RPC.
create index if not exists mecanicos_ubicacion_gist_idx
  on public.mecanicos using gist (ubicacion)
  where ubicacion is not null;

-- Nota: ST_MakePoint recibe primero longitud (X) y después latitud (Y).
-- La función no expone ubicaciones ni datos de talleres suspendidos.
create or replace function public.get_mecanicos_cercanos(
  p_latitud double precision,
  p_longitud double precision,
  p_radio_metros double precision default 5000
)
returns table (
  id_mecanico bigint,
  nombre_taller text,
  whatsapp_destino text,
  especialidades text[],
  zona_cobertura text,
  distancia_metros double precision
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_origen extensions.geography(Point, 4326);
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión activa';
  end if;

  if p_latitud is null or p_latitud not between -90 and 90 then
    raise exception 'Latitud inválida';
  end if;

  if p_longitud is null or p_longitud not between -180 and 180 then
    raise exception 'Longitud inválida';
  end if;

  if p_radio_metros is null or p_radio_metros <= 0 or p_radio_metros > 50000 then
    raise exception 'El radio debe estar entre 0 y 50000 metros';
  end if;

  v_origen := extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_longitud, p_latitud),
    4326
  )::extensions.geography;

  return query
  select
    m.id_mecanico,
    m.nombre_taller,
    m.whatsapp_destino,
    m.especialidades,
    m.zona_cobertura,
    extensions.ST_Distance(m.ubicacion, v_origen) as distancia_metros
  from public.mecanicos m
  where m.estatus_suscripcion = 'Activo'
    and m.ubicacion is not null
    and extensions.ST_DWithin(m.ubicacion, v_origen, p_radio_metros)
  order by extensions.ST_Distance(m.ubicacion, v_origen), m.id_mecanico;
end;
$$;

revoke all on function public.get_mecanicos_cercanos(double precision, double precision, double precision) from public;
grant execute on function public.get_mecanicos_cercanos(double precision, double precision, double precision) to authenticated;
