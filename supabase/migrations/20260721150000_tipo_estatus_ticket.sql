-- Migración para tickets existentes cuyo estatus era varchar o ticket_status.
do $$ begin
  create type public.tipo_estatus_ticket as enum ('Abierto', 'Asignado', 'Concluido', 'Cancelado');
exception when duplicate_object then null;
end $$;

alter table public.tickets alter column estatus drop default;
alter table public.tickets
  alter column estatus type public.tipo_estatus_ticket
  using estatus::text::public.tipo_estatus_ticket;
alter table public.tickets
  alter column estatus set default 'Abierto'::public.tipo_estatus_ticket;
