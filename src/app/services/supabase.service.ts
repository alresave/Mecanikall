import { Injectable } from '@angular/core';
import { createClient, RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  Cliente,
  CrearClienteInput,
  CrearTicketInput,
  Mecanico,
  Ticket,
  TicketConCliente,
  TicketConMecanico,
  TicketStatus,
} from '../models';

/** Acceso centralizado a la API y a eventos en tiempo real de Supabase. */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  /**
   * Busca el cliente por WhatsApp y lo crea cuando aún no existe.
   * Se normaliza el teléfono a diez dígitos antes de consultar.
   */
  async obtenerOCrearCliente(input: CrearClienteInput): Promise<number> {
    const telefono = input.telefono_whatsapp.replace(/\D/g, '');
    const { data: existente, error: errorBusqueda } = await this.client
      .from('clientes')
      .select('id_cliente')
      .eq('telefono_whatsapp', telefono)
      .maybeSingle<Pick<Cliente, 'id_cliente'>>();

    if (errorBusqueda) throw errorBusqueda;
    if (existente) return existente.id_cliente;

    const { data: creado, error: errorCreacion } = await this.client
      .from('clientes')
      .insert({ nombre_completo: input.nombre_completo.trim(), telefono_whatsapp: telefono })
      .select('id_cliente')
      .single<Pick<Cliente, 'id_cliente'>>();

    if (errorCreacion || !creado) {
      throw errorCreacion ?? new Error('No fue posible crear el cliente.');
    }
    return creado.id_cliente;
  }

  async crearTicket(input: CrearTicketInput): Promise<Ticket> {
    const { data, error } = await this.client
      .from('tickets')
      .insert({
        id_cliente: input.id_cliente,
        descripcion_falla: input.descripcion_falla.trim(),
        ubicacion_auto: input.ubicacion_auto.trim(),
        estatus: TicketStatus.Abierto,
      })
      .select()
      .single<Ticket>();

    if (error || !data) throw error ?? new Error('No fue posible crear la solicitud.');
    return data;
  }

  /** Recupera el taller asignado para obtener su nombre y teléfono de contacto. */
  async obtenerTicket(idTicket: number): Promise<TicketConMecanico> {
    const { data, error } = await this.client
      .from('tickets')
      .select('*, mecanico:mecanicos!tickets_id_mecanico_asignado_fkey(id_mecanico, nombre_taller, whatsapp_destino)')
      .eq('id_ticket', idTicket)
      .single<TicketConMecanico>();

    if (error || !data) throw error ?? new Error('No fue posible consultar la solicitud.');
    return data;
  }

  async iniciarSesion(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async cerrarSesion(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async obtenerUsuarioActual(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async obtenerTallerActual(): Promise<Mecanico | null> {
    const usuario = await this.obtenerUsuarioActual();
    if (!usuario) return null;
    const { data, error } = await this.client
      .from('mecanicos')
      .select('id_mecanico, id_usuario, nombre_taller, whatsapp_destino, especialidades, palabras_clave, estatus_suscripcion, zona_cobertura')
      .eq('id_usuario', usuario.id)
      .eq('estatus_suscripcion', 'Activo')
      .maybeSingle();

    if (error) throw error;
    return data as Mecanico | null;
  }

  async obtenerTicketsAbiertos(): Promise<TicketConCliente[]> {
    const { data, error } = await this.client
      .from('tickets')
      .select('*, cliente:clientes!tickets_id_cliente_fkey(nombre_completo, telefono_whatsapp)')
      .eq('estatus', TicketStatus.Abierto)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TicketConCliente[];
  }

  async asignarTicket(idTicket: number, idMecanico: number): Promise<void> {
    const { error } = await this.client
      .from('tickets')
      .update({ estatus: TicketStatus.Asignado, id_mecanico_asignado: idMecanico })
      .eq('id_ticket', idTicket)
      .eq('estatus', TicketStatus.Abierto);

    if (error) throw error;
  }

  suscribirATicketsAbiertos(onChange: () => void): RealtimeChannel {
    return this.client
      .channel('tickets:abiertos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, onChange)
      .subscribe();
  }

  /**
   * Escucha actualizaciones de un ticket. Devuelve el canal para que el componente
   * lo elimine al destruirse o al cambiar de estado.
   */
  suscribirATicket(
    idTicket: number,
    onUpdate: (ticket: Ticket) => void,
    onError?: (error: Error) => void,
  ): RealtimeChannel {
    return this.client
      .channel(`ticket:${idTicket}`)
      .on<Ticket>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id_ticket=eq.${idTicket}` },
        ({ new: ticket }) => onUpdate(ticket),
      )
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onError?.(error instanceof Error ? error : new Error('La conexión en tiempo real falló.'));
        }
      });
  }

  async cancelarSuscripcion(channel: RealtimeChannel | null): Promise<void> {
    if (channel) await this.client.removeChannel(channel);
  }
}
