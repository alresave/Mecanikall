-- Permite que cada taller activo registre su propia ubicación geográfica.
create or replace function public.actualizar_ubicacion_mecanico(
  p_latitud double precision,
  p_longitud double precision
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
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

  update public.mecanicos
  set ubicacion = extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_longitud, p_latitud),
    4326
  )::extensions.geography
  where id_usuario = auth.uid()
    and estatus_suscripcion = 'Activo';

  if not found then
    raise exception 'Taller activo no encontrado';
  end if;
end;
$$;

revoke all on function public.actualizar_ubicacion_mecanico(double precision, double precision) from public;
grant execute on function public.actualizar_ubicacion_mecanico(double precision, double precision) to authenticated;
