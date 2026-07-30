-- Fotos y audios privados de solicitudes: accesibles solo por el solicitante y el taller asignado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-evidencia', 'ticket-evidencia', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp4'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ticket_adjuntos (
  id_adjunto bigint generated always as identity primary key,
  id_ticket bigint not null references public.tickets(id_ticket) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp4')),
  created_at timestamptz not null default now(),
  check (storage_path like '%/%/%')
);
create index if not exists ticket_adjuntos_ticket_idx on public.ticket_adjuntos (id_ticket);
alter table public.ticket_adjuntos enable row level security;

create policy "Solicitante o taller ve evidencia del ticket" on public.ticket_adjuntos for select to authenticated using (
  exists (
    select 1 from public.tickets t left join public.mecanicos m on m.id_mecanico = t.id_mecanico_asignado
    where t.id_ticket = ticket_adjuntos.id_ticket and (t.id_usuario_solicitante = auth.uid() or m.id_usuario = auth.uid())
  )
);
create policy "Solicitante adjunta evidencia propia" on public.ticket_adjuntos for insert to authenticated with check (
  (storage.foldername(storage_path))[1] = auth.uid()::text
  and (storage.foldername(storage_path))[2] = id_ticket::text
  and exists (select 1 from public.tickets t where t.id_ticket = ticket_adjuntos.id_ticket and t.id_usuario_solicitante = auth.uid())
);

create policy "Solicitante sube su evidencia" on storage.objects for insert to authenticated with check (
  bucket_id = 'ticket-evidencia' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Solicitante o taller descarga evidencia" on storage.objects for select to authenticated using (
  bucket_id = 'ticket-evidencia' and exists (
    select 1 from public.ticket_adjuntos a join public.tickets t on t.id_ticket = a.id_ticket left join public.mecanicos m on m.id_mecanico = t.id_mecanico_asignado
    where a.storage_path = name and (t.id_usuario_solicitante = auth.uid() or m.id_usuario = auth.uid())
  )
);
create policy "Solicitante elimina su evidencia" on storage.objects for delete to authenticated using (
  bucket_id = 'ticket-evidencia' and (storage.foldername(name))[1] = auth.uid()::text
);
