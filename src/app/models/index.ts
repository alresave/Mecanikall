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
  radio_cobertura_metros: number;
}

/** Fila devuelta por la RPC `get_mecanicos_cercanos`. La distancia está en metros. */
export interface MecanicoCercano {
  id_mecanico: number;
  nombre_taller: string;
  whatsapp_destino: string;
  especialidades: string[];
  zona_cobertura: string;
  distancia_metros: number;
}

/** Oferta visible al solicitante antes de elegir un taller. Importes en MXN. */
export interface OfertaTicket {
  id_oferta: number;
  id_ticket: number;
  id_mecanico: number;
  nombre_taller: string;
  especialidades: string[];
  precio_estimado: number;
  tiempo_estimado_minutos: number;
  mensaje: string | null;
  created_at: string;
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
  ai_prediagnostico?: DiagnosticoAi | null;
  ai_urgencia?: DiagnosticoAi['urgency'] | null;
}

export interface DiagnosticoAi {
  urgency: 'low' | 'medium' | 'high' | null;
  possibleCauses: string[];
  estimatedCostMxn: string | null;
  nextStep: string | null;
}

export interface TicketConMecanico extends Ticket {
  mecanico?: Pick<Mecanico, 'id_mecanico' | 'nombre_taller' | 'whatsapp_destino'> | null;
}

export interface TicketConCliente extends Ticket {
  cliente?: Pick<Cliente, 'nombre_completo' | 'telefono_whatsapp'> | null;
}

export interface EvidenciaTicket {
  id_adjunto: number;
  id_ticket: number;
  media_type: string;
  url: string;
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

export interface SolicitudRefaccionesTienda { id_solicitud: number; id_ticket: number; descripcion: string; ubicacion_auto: string; nombre_taller: string; created_at: string; }
export interface OfertaRefaccionesTaller { id_oferta: number; id_solicitud: number; id_ticket: number; descripcion: string; nombre_tienda: string; precio_estimado: number; tiempo_estimado_minutos: number; mensaje: string | null; created_at: string; }
export interface ProspectoSuscripcion { tipo: 'Taller' | 'Tienda de refacciones'; id_entidad: number; nombre: string; whatsapp: string; zona_cobertura: string; atenciones: number; }
export interface EntidadOperativa { tipo: 'Taller' | 'Tienda'; id_entidad: number; nombre: string; whatsapp: string; zona: string; estatus: 'Activo' | 'Suspendido' | 'Pendiente'; created_at: string; atenciones_mes: number; }
export interface SeguimientoComercial { tipo_entidad: 'Taller' | 'Tienda de refacciones'; id_entidad:number; estado:string; proxima_accion:string|null; notas:string; asignado_a_mi:boolean; id_responsable:string|null; responsable_email:string|null; }
export interface Vendedor { id_usuario:string; email:string; }
export interface ComisionVendedor { id_comision:number; nombre_taller:string; vendedor_email:string; importe_pago:number; importe_comision:number|null; estatus:'Pendiente'|'Pagada'; created_at:string; pagada_at:string|null; }
export interface ReporteConversion { solicitudes:number; solicitudes_con_oferta:number; ofertas_aceptadas:number; servicios_concluidos:number; suscripciones_activas:number; }
export interface HistorialRefaccionesTaller { id_solicitud:number;id_ticket:number;descripcion:string;estatus:string;nombre_tienda:string|null;accepted_at:string|null;created_at:string; }
export interface HistorialRefaccionesTienda { id_oferta:number;id_solicitud:number;descripcion:string;estatus_oferta:string;estatus_solicitud:string;precio_estimado:number;tiempo_estimado_minutos:number;nombre_taller:string;created_at:string; }
