-- Evita recursión entre las políticas de tickets y mecánicos.
create or replace function public.es_mi_taller(p_id_mecanico bigint)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.mecanicos where id_mecanico = p_id_mecanico and id_usuario = auth.uid());
$$;

drop policy if exists "Taller ve tickets asignados" on public.tickets;
create policy "Taller ve tickets asignados" on public.tickets for select to authenticated
using (public.es_mi_taller(id_mecanico_asignado));

-- Reconstituye la RPC con conversiones explícitas para PostgREST.
drop function if exists public.tickets_abiertos_para_taller();
create function public.tickets_abiertos_para_taller()
returns table (id_ticket bigint, id_cliente bigint, descripcion_falla text, ubicacion_auto text, estatus public.tipo_estatus_ticket, id_mecanico_asignado bigint, created_at timestamptz, updated_at timestamptz, cliente jsonb)
language sql security definer set search_path = public, extensions as $$
  select t.id_ticket::bigint, t.id_cliente::bigint, t.descripcion_falla::text, t.ubicacion_auto::text,
    t.estatus::public.tipo_estatus_ticket, t.id_mecanico_asignado::bigint, t.created_at::timestamptz,
    t.updated_at::timestamptz, null::jsonb
  from public.mecanicos m join public.tickets t on t.estatus = 'Abierto' and t.ubicacion is not null
    and extensions.ST_DWithin(m.ubicacion, t.ubicacion, m.radio_cobertura_metros)
  where m.id_usuario = auth.uid() and m.estatus_suscripcion = 'Activo' and m.ubicacion is not null
  order by t.created_at asc;
$$;
revoke all on function public.tickets_abiertos_para_taller() from public;
grant execute on function public.tickets_abiertos_para_taller() to authenticated;
