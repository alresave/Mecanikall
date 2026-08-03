-- Permite al taller asignado compartir fotos de diagnóstico o cotización con su cliente.
alter table public.ticket_adjuntos
  add column if not exists origen text not null default 'Cliente'
  check (origen in ('Cliente', 'Taller'));

drop policy if exists "Taller adjunta evidencia de su ticket" on public.ticket_adjuntos;
create policy "Taller adjunta evidencia de su ticket" on public.ticket_adjuntos for insert to authenticated with check (
  origen = 'Taller'
  and (storage.foldername(storage_path))[1] = 'taller'
  and (storage.foldername(storage_path))[2] = auth.uid()::text
  and (storage.foldername(storage_path))[3] = id_ticket::text
  and exists (
    select 1 from public.tickets t join public.mecanicos m on m.id_mecanico = t.id_mecanico_asignado
    where t.id_ticket = ticket_adjuntos.id_ticket and t.estatus = 'Asignado' and m.id_usuario = auth.uid()
  )
);

drop policy if exists "Taller sube evidencia de su ticket" on storage.objects;
create policy "Taller sube evidencia de su ticket" on storage.objects for insert to authenticated with check (
  bucket_id = 'ticket-evidencia'
  and (storage.foldername(name))[1] = 'taller'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.tickets t join public.mecanicos m on m.id_mecanico = t.id_mecanico_asignado
    where t.id_ticket::text = (storage.foldername(name))[3] and t.estatus = 'Asignado' and m.id_usuario = auth.uid()
  )
);
