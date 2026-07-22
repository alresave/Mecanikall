-- Seguridad del MVP: ejecutar después de las migraciones anteriores.
-- Requiere habilitar Anonymous Sign-Ins en Authentication > Providers > Anonymous.
alter table public.tickets add column if not exists id_usuario_solicitante uuid references auth.users(id) on delete set null;
create index if not exists tickets_solicitante_idx on public.tickets (id_usuario_solicitante);
-- Requisito del UPSERT atómico usado al registrar la solicitud.
create unique index if not exists clientes_telefono_whatsapp_unique_idx on public.clientes (telefono_whatsapp);

alter table public.clientes enable row level security;
alter table public.mecanicos enable row level security;
alter table public.tickets enable row level security;
drop policy if exists "Clientes públicos pueden consultar" on public.clientes;
drop policy if exists "Clientes públicos pueden crearse" on public.clientes;
drop policy if exists "Perfil del taller autenticado" on public.mecanicos;
drop policy if exists "Datos de contacto de talleres" on public.mecanicos;
drop policy if exists "Solicitante ve taller asignado" on public.mecanicos;
drop policy if exists "Tickets visibles para el flujo MVP" on public.tickets;
drop policy if exists "Clientes pueden crear tickets" on public.tickets;
drop policy if exists "Taller acepta tickets abiertos" on public.tickets;
drop policy if exists "Solicitante ve sus tickets" on public.tickets;
create policy "Perfil del taller autenticado" on public.mecanicos for select to authenticated using (id_usuario = auth.uid());
create policy "Solicitante ve taller asignado" on public.mecanicos for select to authenticated using (exists (select 1 from public.tickets where id_mecanico_asignado = mecanicos.id_mecanico and id_usuario_solicitante = auth.uid()));
create policy "Solicitante ve sus tickets" on public.tickets for select to authenticated using (id_usuario_solicitante = auth.uid());

create or replace function public.solicitar_ayuda(p_nombre text, p_telefono text, p_ubicacion text, p_descripcion text) returns setof public.tickets language plpgsql security definer set search_path = public as $$
declare v_cliente bigint; v_ticket public.tickets;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión activa'; end if;
  if p_telefono !~ '^[0-9]{10}$' then raise exception 'Teléfono inválido'; end if;
  insert into public.clientes (nombre_completo, telefono_whatsapp) values (trim(p_nombre), p_telefono) on conflict (telefono_whatsapp) do update set nombre_completo = excluded.nombre_completo returning id_cliente into v_cliente;
  insert into public.tickets (id_cliente, id_usuario_solicitante, ubicacion_auto, descripcion_falla) values (v_cliente, auth.uid(), trim(p_ubicacion), trim(p_descripcion)) returning * into v_ticket;
  return next v_ticket;
end; $$;

create or replace function public.tickets_abiertos_para_taller() returns table (id_ticket bigint, id_cliente bigint, descripcion_falla text, ubicacion_auto text, estatus public.tipo_estatus_ticket, id_mecanico_asignado bigint, created_at timestamptz, updated_at timestamptz, cliente jsonb) language sql security definer set search_path = public as $$
  select t.id_ticket, t.id_cliente, t.descripcion_falla, t.ubicacion_auto, t.estatus, t.id_mecanico_asignado, t.created_at, t.updated_at, jsonb_build_object('nombre_completo', c.nombre_completo, 'telefono_whatsapp', c.telefono_whatsapp) from public.tickets t join public.clientes c on c.id_cliente = t.id_cliente where t.estatus = 'Abierto' and exists (select 1 from public.mecanicos m where m.id_usuario = auth.uid() and m.estatus_suscripcion = 'Activo') order by t.created_at asc;
$$;

create or replace function public.aceptar_ticket(p_id_ticket bigint) returns setof public.tickets language plpgsql security definer set search_path = public as $$
declare v_mecanico bigint; v_ticket public.tickets;
begin
  select id_mecanico into v_mecanico from public.mecanicos where id_usuario = auth.uid() and estatus_suscripcion = 'Activo';
  if v_mecanico is null then raise exception 'Taller no autorizado'; end if;
  update public.tickets set estatus = 'Asignado', id_mecanico_asignado = v_mecanico where id_ticket = p_id_ticket and estatus = 'Abierto' returning * into v_ticket;
  if not found then raise exception 'La solicitud ya no está disponible' using errcode = 'P0002'; end if;
  return next v_ticket;
end; $$;

revoke all on function public.solicitar_ayuda(text, text, text, text) from public;
grant execute on function public.solicitar_ayuda(text, text, text, text) to authenticated;
revoke all on function public.tickets_abiertos_para_taller() from public;
grant execute on function public.tickets_abiertos_para_taller() to authenticated;
revoke all on function public.aceptar_ticket(bigint) from public;
grant execute on function public.aceptar_ticket(bigint) to authenticated;
