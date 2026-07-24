-- Las notificaciones de tickets usan ON CONFLICT(id_ticket). PostgreSQL permite
-- múltiples NULL en un UNIQUE, por lo que esto sigue permitiendo notificaciones
-- de cotizaciones de refacciones (que no tienen id_ticket).
alter table public.notificaciones_push
  add constraint notificaciones_push_id_ticket_key unique (id_ticket);
