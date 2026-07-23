import { Injectable } from '@angular/core';
import { createClient, RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  CrearClienteInput,
  Mecanico,
  MecanicoCercano,
  OfertaTicket,
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

  /** Conserva una sesión existente o crea la sesión anónima requerida por las RPC públicas. */
  private async asegurarSesion(): Promise<void> {
    const { data, error: sessionError } = await this.client.auth.getSession();
    if (sessionError) throw sessionError;
    if (data.session) return;

    const { error } = await this.client.auth.signInAnonymously();
    if (error) throw new Error('No pudimos iniciar una sesión segura. Intenta de nuevo.');
  }

  /** Crea una sesión anónima y registra la solicitud sin exponer datos de clientes. */
  async solicitarAyuda(input: CrearClienteInput & {
    ubicacion_auto: string;
    descripcion_falla: string;
    latitud: number;
    longitud: number;
  }): Promise<Ticket> {
    await this.asegurarSesion();
    const { data, error } = await this.client.rpc('solicitar_ayuda', {
      p_nombre: input.nombre_completo.trim(),
      p_telefono: input.telefono_whatsapp.replace(/\D/g, ''),
      p_ubicacion: input.ubicacion_auto.trim(),
      p_descripcion: input.descripcion_falla.trim(),
      p_latitud: input.latitud,
      p_longitud: input.longitud,
    }).single<Ticket>();
    if (error || !data) throw error ?? new Error('No fue posible crear la solicitud.');
    return data;
  }

  /**
   * Encuentra talleres activos dentro del radio indicado, usando PostGIS en Supabase.
   * La latitud y longitud deben provenir, por ejemplo, de `navigator.geolocation`.
   */
  async obtenerMecanicosCercanos(
    latitud: number,
    longitud: number,
    radioMetros = 5000,
  ): Promise<MecanicoCercano[]> {
    await this.asegurarSesion();

    const { data, error } = await this.client.rpc('get_mecanicos_cercanos', {
      p_latitud: latitud,
      p_longitud: longitud,
      p_radio_metros: radioMetros,
    });

    if (error) throw error;
    return (data ?? []) as MecanicoCercano[];
  }

  /**
   * Guarda la ubicación actual del taller autenticado usando coordenadas WGS84.
   * Debe invocarse tras obtener permiso del usuario con `navigator.geolocation`.
   */
  async actualizarUbicacionMecanico(latitud: number, longitud: number): Promise<void> {
    const { error } = await this.client.rpc('actualizar_ubicacion_mecanico', {
      p_latitud: latitud,
      p_longitud: longitud,
    });

    if (error) throw error;
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

  /** Devuelve tickets abiertos dentro del radio configurado desde el taller autenticado. */
  async obtenerTicketsAbiertos(radioMetros = 5000): Promise<TicketConCliente[]> {
    const { data, error } = await this.client.rpc('tickets_abiertos_para_taller', {
      p_radio_metros: radioMetros,
    });

    if (error) throw error;
    return (data ?? []) as TicketConCliente[];
  }

  async enviarOferta(idTicket: number, precioEstimado: number, tiempoEstimadoMinutos: number, mensaje?: string): Promise<void> {
    const { error } = await this.client.rpc('enviar_oferta', {
      p_id_ticket: idTicket, p_precio_estimado: precioEstimado,
      p_tiempo_estimado_minutos: tiempoEstimadoMinutos, p_mensaje: mensaje?.trim() || null,
    });
    if (error) throw error;
  }

  async obtenerOfertasParaCliente(idTicket: number): Promise<OfertaTicket[]> {
    const { data, error } = await this.client.rpc('ofertas_para_cliente', { p_id_ticket: idTicket });
    if (error) throw error;
    return (data ?? []) as OfertaTicket[];
  }

  async aceptarOferta(idOferta: number): Promise<Ticket> {
    const { data, error } = await this.client.rpc('aceptar_oferta', { p_id_oferta: idOferta }).single<Ticket>();
    if (error || !data) throw error ?? new Error('La oferta ya no está disponible.');
    return data;
  }

  suscribirAOfertas(idTicket: number, onChange: () => void): RealtimeChannel {
    return this.client.channel(`ofertas:${idTicket}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ofertas_ticket', filter: `id_ticket=eq.${idTicket}` }, onChange)
      .subscribe();
  }

  async obtenerMisTicketsAsignados(): Promise<TicketConCliente[]> {
    const { data, error } = await this.client.rpc('tickets_asignados_del_taller');
    if (error) throw error;
    return (data ?? []) as TicketConCliente[];
  }

  async concluirTicket(idTicket: number): Promise<Ticket> {
    const { data, error } = await this.client.rpc('concluir_ticket', { p_id_ticket: idTicket }).single<Ticket>();
    if (error || !data) throw error ?? new Error('No fue posible concluir el servicio.');
    return data;
  }

  async cancelarTicket(idTicket: number): Promise<Ticket> {
    const { data, error } = await this.client.rpc('cancelar_ticket', { p_id_ticket: idTicket }).single<Ticket>();
    if (error || !data) throw error ?? new Error('No fue posible cancelar la solicitud.');
    return data;
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
