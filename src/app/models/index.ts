/** Refleja exactamente el ENUM `public.tipo_estatus_ticket` de Postgres. */
export enum TicketStatus {
  Abierto = 'Abierto',
  Asignado = 'Asignado',
  Concluido = 'Concluido',
  Cancelado = 'Cancelado',
}

export interface Cliente {
  id_cliente: number;
  nombre_completo: string;
  telefono_whatsapp: string;
  created_at: string;
}

export interface Mecanico {
  id_mecanico: number;
  id_usuario: string;
  nombre_taller: string;
  whatsapp_destino: string;
  especialidades: string[];
  palabras_clave: string[];
  estatus_suscripcion: string;
  zona_cobertura: string;
}

export interface Ticket {
  id_ticket: number;
  id_cliente: number;
  descripcion_falla: string;
  ubicacion_auto: string;
  estatus: TicketStatus;
  id_mecanico_asignado: number | null;
  created_at: string;
  updated_at?: string;
}

export interface TicketConMecanico extends Ticket {
  mecanico?: Pick<Mecanico, 'id_mecanico' | 'nombre_taller' | 'whatsapp_destino'> | null;
}

export interface TicketConCliente extends Ticket {
  cliente?: Pick<Cliente, 'nombre_completo' | 'telefono_whatsapp'> | null;
}

export interface CrearClienteInput {
  nombre_completo: string;
  telefono_whatsapp: string;
}

export interface CrearTicketInput {
  id_cliente: number;
  descripcion_falla: string;
  ubicacion_auto: string;
}
