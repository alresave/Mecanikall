-- `solicitar_ayuda` usa ON CONFLICT(telefono_whatsapp); PostgreSQL exige una
-- restricción o índice único. Primero consolidamos duplicados sin perder tickets.
with clientes_canonicos as (
  select id_cliente, min(id_cliente) over (partition by telefono_whatsapp) as id_cliente_canonico
  from public.clientes
)
update public.tickets t
set id_cliente = c.id_cliente_canonico
from clientes_canonicos c
where t.id_cliente = c.id_cliente and c.id_cliente <> c.id_cliente_canonico;

delete from public.clientes c
using (
  select id_cliente, row_number() over (partition by telefono_whatsapp order by id_cliente) as posicion
  from public.clientes
) duplicados
where c.id_cliente = duplicados.id_cliente and duplicados.posicion > 1;

create unique index if not exists clientes_telefono_whatsapp_conflict_idx
  on public.clientes (telefono_whatsapp);
