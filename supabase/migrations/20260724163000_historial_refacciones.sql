create or replace function public.historial_refacciones_taller()
returns table (id_solicitud bigint,id_ticket bigint,descripcion text,estatus text,nombre_tienda text,accepted_at timestamptz,created_at timestamptz)
language sql security definer set search_path=public as $$
 select s.id_solicitud,s.id_ticket,s.descripcion,s.estatus::text,tr.nombre_tienda,s.accepted_at,s.created_at
 from public.solicitudes_refacciones s join public.mecanicos m on m.id_mecanico=s.id_mecanico left join public.tiendas_refacciones tr on tr.id_tienda=s.id_tienda_asignada
 where m.id_usuario=auth.uid() order by s.created_at desc;
$$;
create or replace function public.historial_refacciones_tienda()
returns table (id_oferta bigint,id_solicitud bigint,descripcion text,estatus_oferta text,estatus_solicitud text,precio_estimado numeric,tiempo_estimado_minutos integer,nombre_taller text,created_at timestamptz)
language sql security definer set search_path=public as $$
 select o.id_oferta,o.id_solicitud,s.descripcion,o.estatus::text,s.estatus::text,o.precio_estimado,o.tiempo_estimado_minutos,m.nombre_taller,o.created_at
 from public.ofertas_refacciones o join public.tiendas_refacciones tr on tr.id_tienda=o.id_tienda join public.solicitudes_refacciones s on s.id_solicitud=o.id_solicitud join public.mecanicos m on m.id_mecanico=s.id_mecanico
 where tr.id_usuario=auth.uid() order by o.created_at desc;
$$;
revoke all on function public.historial_refacciones_taller(),public.historial_refacciones_tienda() from public;
grant execute on function public.historial_refacciones_taller(),public.historial_refacciones_tienda() to authenticated;
