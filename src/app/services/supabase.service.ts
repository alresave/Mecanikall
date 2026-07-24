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
  SolicitudRefaccionesTienda,
  OfertaRefaccionesTaller,
  ProspectoSuscripcion,
  EntidadOperativa,
  SeguimientoComercial,
  HistorialRefaccionesTaller, HistorialRefaccionesTienda,
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

  async actualizarRadioCoberturaMecanico(radioMetros: number): Promise<void> {
    const { error } = await this.client.rpc('actualizar_radio_cobertura_mecanico', {
      p_radio_metros: radioMetros,
    });
    if (error) throw error;
  }

  async registrarSuscripcionPush(tokenFcm: string, userAgent: string): Promise<void> {
    const { error } = await this.client.rpc('registrar_suscripcion_push', {
      p_token_fcm: tokenFcm,
      p_user_agent: userAgent,
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

  async esAdministrador(): Promise<boolean> {
    const { data, error } = await this.client.rpc('es_administrador');
    if (error) throw error;
    return Boolean(data);
  }

  async obtenerRolBackoffice(): Promise<'admin' | 'ventas' | null> {
    const { data, error } = await this.client.rpc('mi_rol_backoffice');
    if (error) throw error;
    return data === 'admin' || data === 'ventas' ? data : null;
  }

  async activarAdministradorInicial(): Promise<void> {
    const { error } = await this.client.functions.invoke('bootstrap-admin');
    if (error) throw error;
  }

  async crearMecanicoAdministrativo(input: { email: string; nombre_taller: string; whatsapp_destino: string; zona_cobertura: string; especialidades: string[] }): Promise<void> {
    const { error } = await this.client.functions.invoke('crear-mecanico', { body: input });
    if (error) throw error;
  }

  async crearVendedor(email: string): Promise<void> {
    const { error } = await this.client.functions.invoke('crear-vendedor', { body: { email } });
    if (error) throw error;
  }

  async crearAdministrador(email: string): Promise<void> {
    const { error } = await this.client.functions.invoke('crear-administrador', { body: { email } });
    if (error) throw error;
  }

  async invitarTiendaRefacciones(input: { email: string; nombre_tienda: string; whatsapp_destino: string; zona_cobertura: string; radio_cobertura_metros: number }): Promise<void> {
    const { error } = await this.client.functions.invoke('crear-tienda-refacciones', { body: input });
    if (error) throw error;
  }

  async crearSolicitudRefacciones(idTicket: number, descripcion: string): Promise<void> { const { error } = await this.client.rpc('crear_solicitud_refacciones', { p_id_ticket: idTicket, p_descripcion: descripcion }); if (error) throw error; }
  async obtenerOfertasRefaccionesParaTaller(): Promise<OfertaRefaccionesTaller[]> { const { data, error } = await this.client.rpc('ofertas_refacciones_para_taller'); if (error) throw error; return (data ?? []) as OfertaRefaccionesTaller[]; }
  async aceptarOfertaRefacciones(idOferta: number): Promise<void> { const { error } = await this.client.rpc('aceptar_oferta_refacciones', { p_id_oferta: idOferta }); if (error) throw error; }
  async obtenerSolicitudesRefaccionesParaTienda(): Promise<SolicitudRefaccionesTienda[]> { const { data, error } = await this.client.rpc('solicitudes_refacciones_para_tienda'); if (error) throw error; return (data ?? []) as SolicitudRefaccionesTienda[]; }
  async enviarOfertaRefacciones(idSolicitud: number, precio: number, minutos: number, mensaje: string): Promise<void> { const { error } = await this.client.rpc('enviar_oferta_refacciones', { p_id_solicitud: idSolicitud, p_precio_estimado: precio, p_tiempo_estimado_minutos: minutos, p_mensaje: mensaje }); if (error) throw error; }
  async esTiendaRefacciones(): Promise<boolean> { const usuario = await this.obtenerUsuarioActual(); if (!usuario) return false; const { data, error } = await this.client.from('tiendas_refacciones').select('id_tienda').eq('id_usuario', usuario.id).maybeSingle(); if (error) throw error; return Boolean(data); }
  async obtenerProspectosSuscripcion(mes: string): Promise<ProspectoSuscripcion[]> { const { data, error } = await this.client.rpc('prospectos_suscripcion_mensual', { p_mes: `${mes}-01` }); if (error) throw error; return (data ?? []) as ProspectoSuscripcion[]; }
  async obtenerEntidadesOperativas(): Promise<EntidadOperativa[]> { const { data,error }=await this.client.rpc('entidades_operativas');if(error)throw error;return(data??[])as EntidadOperativa[]; }
  async actualizarEstatusEntidad(tipo:'Taller'|'Tienda',id:number,estatus:'Activo'|'Suspendido'|'Pendiente'):Promise<void>{const{error}=await this.client.rpc('actualizar_estatus_entidad',{p_tipo:tipo,p_id_entidad:id,p_estatus:estatus});if(error)throw error;}
  async historialRefaccionesTaller():Promise<HistorialRefaccionesTaller[]>{const{data,error}=await this.client.rpc('historial_refacciones_taller');if(error)throw error;return(data??[])as HistorialRefaccionesTaller[];}
  async historialRefaccionesTienda():Promise<HistorialRefaccionesTienda[]>{const{data,error}=await this.client.rpc('historial_refacciones_tienda');if(error)throw error;return(data??[])as HistorialRefaccionesTienda[];}
  async obtenerSeguimientosComerciales():Promise<SeguimientoComercial[]>{const{data,error}=await this.client.rpc('seguimientos_comerciales_actuales');if(error)throw error;return(data??[])as SeguimientoComercial[];}
  async guardarSeguimientoComercial(tipo:'Taller'|'Tienda de refacciones',id:number,estado:string,proximaAccion:string,notas:string,asignarme:boolean):Promise<void>{const{error}=await this.client.rpc('guardar_seguimiento_comercial',{p_tipo_entidad:tipo,p_id_entidad:id,p_estado:estado,p_proxima_accion:proximaAccion||null,p_notas:notas,p_asignarme:asignarme});if(error)throw error;}

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
      .select('id_mecanico, id_usuario, nombre_taller, whatsapp_destino, especialidades, palabras_clave, estatus_suscripcion, zona_cobertura, radio_cobertura_metros')
      .eq('id_usuario', usuario.id)
      .eq('estatus_suscripcion', 'Activo')
      .maybeSingle();

    if (error) throw error;
    return data as Mecanico | null;
  }

  /** Devuelve tickets abiertos dentro del radio configurado por el propio taller. */
  async obtenerTicketsAbiertos(): Promise<TicketConCliente[]> {
    const { data, error } = await this.client.rpc('tickets_abiertos_para_taller');

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
