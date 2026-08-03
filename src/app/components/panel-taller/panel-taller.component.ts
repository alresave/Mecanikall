import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EvidenciaTicket, HistorialRefaccionesTaller, Mecanico, OfertaRefaccionesTaller, TicketConCliente } from '../../models';
import { NotificationService } from '../../services/notification.service';
import { SupabaseService } from '../../services/supabase.service';

interface BorradorOferta { precio: number | null; minutos: number | null; mensaje: string; }

@Component({
  selector: 'app-panel-taller',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-dvh bg-slate-950 px-5 py-8 text-slate-50 sm:px-8">
      <section class="mx-auto w-full max-w-3xl">
        <header class="mb-8 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3"><div class="grid size-11 place-items-center overflow-hidden rounded-lg"><img src="mecanikall.png" alt="Mecanikall" class="size-11 object-cover" /></div><div><p class="text-lg font-bold tracking-tight">Mecanikall</p><p class="text-xs text-slate-400">Panel de talleres</p></div></div>
          <div class="flex gap-4"><a routerLink="/" class="text-sm font-medium text-orange-400 hover:text-orange-300">Vista cliente</a><a routerLink="/admin" class="text-sm font-medium text-slate-400 hover:text-orange-300">Administración</a><button type="button" class="text-sm font-medium text-slate-400 hover:text-slate-50" (click)="salir()">Salir</button></div>
        </header>

        @if (error()) { <p role="alert" class="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{{ error() }}</p> }

        <div class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-xs font-bold tracking-[.2em] text-orange-400">TALLER ACTIVO</p>
          <p class="mt-2 text-lg font-bold">{{ taller()?.nombre_taller ?? 'Cargando taller…' }}</p>
          <div class="mt-1 flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-slate-400">{{ taller()?.zona_cobertura }}</p><div class="flex flex-wrap gap-2"><button type="button" class="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-orange-400 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50" [disabled]="activandoNotificaciones() || notificacionesActivas()" (click)="activarNotificaciones()">{{ notificacionesActivas() ? 'Notificaciones activas' : activandoNotificaciones() ? 'Activando…' : 'Activar notificaciones' }}</button><button type="button" class="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-orange-400 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50" [disabled]="actualizandoUbicacion()" (click)="actualizarUbicacion()">{{ actualizandoUbicacion() ? 'Actualizando ubicación…' : 'Actualizar mi ubicación' }}</button></div></div>
          <label class="mt-4 block text-sm text-slate-300">Radio de cobertura<select class="ml-3 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-50" [value]="taller()?.radio_cobertura_metros ?? 5000" [disabled]="actualizandoRadio()" (change)="actualizarRadioCobertura($any($event.target).value)"><option value="3000">3 km</option><option value="5000">5 km</option><option value="10000">10 km</option><option value="20000">20 km</option></select></label>
        </div>

        @if (taller()) { <form class="mt-5 space-y-3 rounded-2xl border border-cyan-400/40 bg-slate-800 p-5" [formGroup]="tiendaForm" (ngSubmit)="invitarTiendaRefacciones()"><p class="font-bold">Invitar tienda de refacciones</p><p class="text-sm text-slate-400">La tienda recibirá un correo para crear su contraseña. Quedará vinculada a tu taller.</p><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="nombre_tienda" placeholder="Nombre de la tienda" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="email" type="email" placeholder="Correo" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="whatsapp_destino" placeholder="WhatsApp" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="zona_cobertura" placeholder="Zona de cobertura" /><select class="w-full rounded-lg bg-slate-900 p-3" formControlName="radio_cobertura_metros"><option value="3000">3 km</option><option value="5000">5 km</option><option value="10000">10 km</option><option value="20000">20 km</option></select><button type="submit" class="w-full rounded-lg border border-cyan-400 p-3 font-bold text-cyan-200 disabled:opacity-50" [disabled]="tiendaForm.invalid || invitandoTienda()">{{ invitandoTienda() ? 'Enviando…' : 'Enviar invitación a la tienda' }}</button></form> }

        @if (asignados().length) { <form class="mt-5 space-y-3 rounded-2xl border border-cyan-400/40 bg-slate-800 p-5" [formGroup]="refaccionForm" (ngSubmit)="solicitarRefacciones()"><p class="font-bold">Solicitar refacciones</p><select class="w-full rounded-lg bg-slate-900 p-3" formControlName="id_ticket">@for(ticket of asignados();track ticket.id_ticket){<option [value]="ticket.id_ticket">Ticket #{{ticket.id_ticket}} — {{ticket.descripcion_falla}}</option>}</select><textarea class="min-h-20 w-full rounded-lg bg-slate-900 p-3" formControlName="descripcion" placeholder="Refacciones requeridas, marca, modelo, número de parte…"></textarea><button class="w-full rounded-lg border border-cyan-400 p-3 font-bold text-cyan-200 disabled:opacity-50" [disabled]="refaccionForm.invalid || solicitandoRefacciones()">{{solicitandoRefacciones()?'Enviando…':'Solicitar cotizaciones'}}</button></form> }
        @if (ofertasRefacciones().length) { <div class="mt-5 rounded-2xl border border-cyan-400/40 bg-slate-800 p-5"><p class="font-bold">Cotizaciones de refacciones</p>@for(oferta of ofertasRefacciones();track oferta.id_oferta){<div class="mt-4 rounded-lg bg-slate-900 p-4"><p class="font-bold">{{oferta.nombre_tienda}} · MXN {{oferta.precio_estimado}}</p><p class="mt-1 text-sm text-slate-400">{{oferta.descripcion}} · {{oferta.tiempo_estimado_minutos}} min</p>@if(oferta.mensaje){<p class="mt-1 text-sm text-slate-300">{{oferta.mensaje}}</p>}<button class="mt-3 rounded-lg border border-cyan-400 px-3 py-2 text-sm text-cyan-200" (click)="aceptarOfertaRefacciones(oferta.id_oferta)">Aceptar cotización</button></div>}</div> }
        @if (historialRefacciones().length) { <div class="mt-5 rounded-2xl border border-slate-700 bg-slate-800 p-5"><p class="font-bold">Historial de refacciones</p>@for(solicitud of historialRefacciones();track solicitud.id_solicitud){<p class="mt-3 text-sm text-slate-300">Ticket #{{solicitud.id_ticket}} · {{solicitud.estatus}}@if(solicitud.nombre_tienda){ · {{solicitud.nombre_tienda}} }</p>}</div> }

        <div class="mt-8 flex items-end justify-between gap-4"><div><p class="text-xs font-bold tracking-[.2em] text-orange-400">SOLICITUDES DISPONIBLES</p><h1 class="mt-2 text-2xl font-bold">Servicios cerca de ti</h1></div><button type="button" class="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-orange-400 hover:text-orange-400" (click)="cargarTickets()">Actualizar</button></div>

        @if (cargando()) { <div class="py-16 text-center text-sm text-slate-400">Cargando solicitudes…</div> }
        @else if (!taller()) { <div class="mt-5 rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-400">Esta cuenta no está asociada a un taller activo. Pide al administrador que la vincule.</div> }
        @else if (!tickets().length) { <div class="mt-5 rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-400">No hay solicitudes abiertas por el momento.</div> }
        @else { <div class="mt-5 grid gap-4 md:grid-cols-2">
          @for (ticket of tickets(); track ticket.id_ticket) {
            <article class="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-lg shadow-black/20">
              <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">{{ ticket.cliente?.nombre_completo ?? 'Cliente' }}</p><p class="mt-1 text-xs text-slate-400">{{ ticket.created_at | date:'short' }}</p></div><span class="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-400">Abierto</span></div>
              <dl class="mt-5 space-y-4 text-sm"><div><dt class="text-xs font-bold tracking-wide text-slate-500">UBICACIÓN</dt><dd class="mt-1 text-slate-200">{{ ticket.ubicacion_auto }}</dd></div><div><dt class="text-xs font-bold tracking-wide text-slate-500">FALLA REPORTADA</dt><dd class="mt-1 leading-6 text-slate-300">{{ ticket.descripcion_falla }}</dd></div></dl>
              <div class="mt-5 grid grid-cols-2 gap-3"><label class="text-xs text-slate-400">Precio estimado (MXN)<input class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100" type="number" min="0" [value]="borradorOferta(ticket.id_ticket).precio ?? ''" (input)="actualizarBorrador(ticket.id_ticket, 'precio', $any($event.target).value)" /></label><label class="text-xs text-slate-400">Llegada (min)<input class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100" type="number" min="1" [value]="borradorOferta(ticket.id_ticket).minutos ?? ''" (input)="actualizarBorrador(ticket.id_ticket, 'minutos', $any($event.target).value)" /></label></div>
              <label class="mt-3 block text-xs text-slate-400">Mensaje opcional<textarea class="mt-1 min-h-16 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100" maxlength="500" [value]="borradorOferta(ticket.id_ticket).mensaje" (input)="actualizarBorrador(ticket.id_ticket, 'mensaje', $any($event.target).value)"></textarea></label>
              <button type="button" class="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50" [disabled]="enviandoOferta() === ticket.id_ticket" (click)="enviarOferta(ticket)">{{ enviandoOferta() === ticket.id_ticket ? 'Enviando oferta…' : 'Enviar oferta' }}</button>
            </article>
          }
        </div> }

        <div class="mt-10"><p class="text-xs font-bold tracking-[.2em] text-orange-400">SERVICIOS ASIGNADOS</p><h2 class="mt-2 text-xl font-bold">En atención</h2>
          @if (!asignados().length) { <p class="mt-4 text-sm text-slate-400">No tienes servicios asignados.</p> }
          @else { <div class="mt-4 grid gap-4 md:grid-cols-2">@for (ticket of asignados(); track ticket.id_ticket) {
            <article class="rounded-2xl border border-slate-700 bg-slate-800 p-5"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">{{ ticket.cliente?.nombre_completo ?? 'Cliente' }}</p><p class="mt-1 text-xs text-slate-400">{{ ticket.ubicacion_auto }}</p></div><span class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">Asignado</span></div><p class="mt-4 text-sm leading-6 text-slate-300">{{ ticket.descripcion_falla }}</p>@if (evidenciaTicket(ticket.id_ticket).length) { <div class="mt-4 grid grid-cols-2 gap-2">@for (archivo of evidenciaTicket(ticket.id_ticket); track archivo.id_adjunto) { @if (archivo.media_type.startsWith('image/')) { <a [href]="archivo.url" target="_blank" rel="noopener noreferrer"><img class="h-24 w-full rounded object-cover" [src]="archivo.url" alt="Evidencia del servicio" /></a> } @else { <audio class="w-full" controls [src]="archivo.url"></audio> } }</div> }<label class="mt-4 block cursor-pointer rounded-xl border border-cyan-400/50 px-4 py-3 text-center text-sm font-bold text-cyan-200 hover:bg-cyan-500/10"><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="adjuntarDiagnostico(ticket, $event)" [disabled]="subiendoDiagnostico() === ticket.id_ticket" />{{ subiendoDiagnostico() === ticket.id_ticket ? 'Adjuntando fotos…' : 'Adjuntar fotos de diagnóstico o cotización' }}</label><a class="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300" [href]="whatsappCliente(ticket)" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a><button type="button" class="mt-4 w-full rounded-xl border border-emerald-400/50 px-4 py-3 font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50" [disabled]="concluyendo() === ticket.id_ticket" (click)="concluir(ticket)">{{ concluyendo() === ticket.id_ticket ? 'Concluyendo…' : 'Marcar como concluido' }}</button></article>
          }</div> }
        </div>
      </section>
    </main>
  `,
})
export class PanelTallerComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private canal: RealtimeChannel | null = null;

  readonly taller = signal<Mecanico | null>(null);
  readonly tickets = signal<TicketConCliente[]>([]);
  readonly asignados = signal<TicketConCliente[]>([]);
  readonly cargando = signal(true);
  readonly enviandoOferta = signal<number | null>(null);
  readonly concluyendo = signal<number | null>(null);
  readonly actualizandoUbicacion = signal(false);
  readonly actualizandoRadio = signal(false);
  readonly activandoNotificaciones = signal(false);
  readonly notificacionesActivas = signal(false);
  readonly invitandoTienda = signal(false);
  readonly solicitandoRefacciones = signal(false);
  readonly error = signal<string | null>(null);
  readonly borradoresOferta = signal<Record<number, BorradorOferta>>({});
  readonly tiendaForm = this.fb.nonNullable.group({ nombre_tienda: ['', Validators.required], email: ['', [Validators.required, Validators.email]], whatsapp_destino: ['', Validators.required], zona_cobertura: ['', Validators.required], radio_cobertura_metros: [5000, Validators.required] });
  readonly refaccionForm = this.fb.nonNullable.group({ id_ticket: [0, Validators.min(1)], descripcion: ['', [Validators.required, Validators.minLength(3)]] });
  readonly ofertasRefacciones = signal<OfertaRefaccionesTaller[]>([]);
  readonly historialRefacciones = signal<HistorialRefaccionesTaller[]>([]);
  readonly evidenciaPorTicket = signal<Record<number, EvidenciaTicket[]>>({});
  readonly subiendoDiagnostico = signal<number | null>(null);

  constructor() {
    void this.inicializar();
    this.destroyRef.onDestroy(() => void this.supabase.cancelarSuscripcion(this.canal));
  }

  async cargarTickets(): Promise<void> {
    this.cargando.set(true);
    try { const [abiertos, asignados, ofertas, historial] = await Promise.all([this.supabase.obtenerTicketsAbiertos(), this.supabase.obtenerMisTicketsAsignados(), this.supabase.obtenerOfertasRefaccionesParaTaller(), this.supabase.historialRefaccionesTaller()]); const evidencia = await this.supabase.obtenerEvidenciaTickets([...abiertos, ...asignados].map((ticket) => ticket.id_ticket)); this.tickets.set(abiertos); this.asignados.set(asignados); this.ofertasRefacciones.set(ofertas); this.historialRefacciones.set(historial); this.evidenciaPorTicket.set(evidencia.reduce<Record<number, EvidenciaTicket[]>>((porTicket, archivo) => ({ ...porTicket, [archivo.id_ticket]: [...(porTicket[archivo.id_ticket] ?? []), archivo] }), {})); this.error.set(null); }
    catch { this.error.set('No pudimos cargar las solicitudes. Revisa tu conexión y permisos.'); }
    finally { this.cargando.set(false); }
  }

  borradorOferta(idTicket: number): BorradorOferta {
    return this.borradoresOferta()[idTicket] ?? { precio: null, minutos: null, mensaje: '' };
  }

  actualizarBorrador(idTicket: number, campo: keyof BorradorOferta, valor: string): void {
    const actual = this.borradorOferta(idTicket);
    const numero = campo === 'mensaje' ? null : Number(valor);
    this.borradoresOferta.update((borradores) => ({
      ...borradores,
      [idTicket]: { ...actual, [campo]: campo === 'mensaje' ? valor : (Number.isFinite(numero) && valor !== '' ? numero : null) },
    }));
  }

  async enviarOferta(ticket: TicketConCliente): Promise<void> {
    const oferta = this.borradorOferta(ticket.id_ticket);
    if (oferta.precio === null || oferta.minutos === null || oferta.precio < 0 || oferta.minutos < 1) {
      this.error.set('Indica un precio válido y el tiempo estimado de llegada.');
      return;
    }
    this.enviandoOferta.set(ticket.id_ticket);
    try {
      await this.supabase.enviarOferta(ticket.id_ticket, oferta.precio, oferta.minutos, oferta.mensaje);
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'No fue posible enviar la oferta.');
    } finally { this.enviandoOferta.set(null); }
  }

  async concluir(ticket: TicketConCliente): Promise<void> {
    this.concluyendo.set(ticket.id_ticket);
    try { await this.supabase.concluirTicket(ticket.id_ticket); await this.cargarTickets(); }
    catch { this.error.set('No fue posible concluir el servicio.'); }
    finally { this.concluyendo.set(null); }
  }

  async adjuntarDiagnostico(ticket: TicketConCliente, evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    if (!archivos.length) return;
    if (archivos.length > 3 || archivos.some((archivo) => !['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size > 8 * 1024 * 1024)) {
      this.error.set('Adjunta hasta 3 fotos JPG, PNG o WebP de máximo 8 MB cada una.');
      return;
    }
    this.subiendoDiagnostico.set(ticket.id_ticket);
    try {
      await this.supabase.subirEvidenciaDiagnostico(ticket.id_ticket, archivos);
      await this.cargarTickets();
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'No pudimos adjuntar las fotos del diagnóstico.');
    } finally { this.subiendoDiagnostico.set(null); }
  }

  /** Actualiza el punto PostGIS del taller y recarga los servicios dentro de 5 km. */
  async actualizarUbicacion(): Promise<void> {
    if (!navigator.geolocation) {
      this.error.set('Tu navegador no permite obtener la ubicación.');
      return;
    }

    this.actualizandoUbicacion.set(true);
    this.error.set(null);
    try {
      const coordenadas = await this.obtenerUbicacionActual();
      await this.supabase.actualizarUbicacionMecanico(coordenadas.latitud, coordenadas.longitud);
      await this.cargarTickets();
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'No pudimos actualizar la ubicación del taller.');
    } finally {
      this.actualizandoUbicacion.set(false);
    }
  }

  async actualizarRadioCobertura(valor: string): Promise<void> {
    const radioMetros = Number(valor);
    if (![3000, 5000, 10000, 20000].includes(radioMetros)) return;
    this.actualizandoRadio.set(true);
    try {
      await this.supabase.actualizarRadioCoberturaMecanico(radioMetros);
      this.taller.update((taller) => taller ? { ...taller, radio_cobertura_metros: radioMetros } : taller);
      await this.cargarTickets();
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'No pudimos actualizar el radio de cobertura.');
    } finally {
      this.actualizandoRadio.set(false);
    }
  }

  async activarNotificaciones(): Promise<void> {
    this.activandoNotificaciones.set(true);
    this.error.set(null);
    try {
      const token = await this.notifications.activarNotificaciones();
      if (token) {
        this.notificacionesActivas.set(true);
      } else {
        this.error.set('Las notificaciones no fueron autorizadas. Puedes habilitarlas desde la configuración del navegador.');
      }
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'No pudimos activar las notificaciones.');
    } finally {
      this.activandoNotificaciones.set(false);
    }
  }

  async invitarTiendaRefacciones(): Promise<void> {
    if (this.tiendaForm.invalid) return;
    this.invitandoTienda.set(true);
    this.error.set(null);
    try {
      await this.supabase.invitarTiendaRefacciones(this.tiendaForm.getRawValue());
      this.tiendaForm.reset({ radio_cobertura_metros: 5000 });
    } catch (error) {
      this.error.set(error instanceof Error && error.message ? error.message : 'No fue posible enviar la invitación a la tienda.');
    } finally {
      this.invitandoTienda.set(false);
    }
  }

  async solicitarRefacciones(): Promise<void> { if (this.refaccionForm.invalid) return; this.solicitandoRefacciones.set(true); try { const v=this.refaccionForm.getRawValue(); await this.supabase.crearSolicitudRefacciones(v.id_ticket, v.descripcion); this.refaccionForm.reset({id_ticket: 0, descripcion: ''}); this.error.set(null); } catch(error) { this.error.set(error instanceof Error ? error.message : 'No fue posible solicitar las refacciones.'); } finally { this.solicitandoRefacciones.set(false); } }
  async aceptarOfertaRefacciones(idOferta: number): Promise<void> { try { await this.supabase.aceptarOfertaRefacciones(idOferta); await this.cargarTickets(); } catch { this.error.set('No fue posible aceptar la cotización.'); } }

  whatsappCliente(ticket: TicketConCliente): string { return `https://wa.me/${ticket.cliente?.telefono_whatsapp.replace(/\\D/g, '') ?? ''}`; }
  evidenciaTicket(idTicket: number): EvidenciaTicket[] { return this.evidenciaPorTicket()[idTicket] ?? []; }

  async salir(): Promise<void> { await this.supabase.cerrarSesion(); await this.router.navigateByUrl('/acceso'); }

  private obtenerUbicacionActual(): Promise<{ latitud: number; longitud: number }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitud: coords.latitude, longitud: coords.longitude }),
        () => reject(new Error('Necesitamos permiso de ubicación para mostrar servicios cercanos.')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }

  private async inicializar(): Promise<void> {
    try { this.taller.set(await this.supabase.obtenerTallerActual()); await this.cargarTickets(); this.refaccionForm.patchValue({ id_ticket: this.asignados()[0]?.id_ticket ?? 0 }); this.canal = this.supabase.suscribirATicketsAbiertos(() => void this.cargarTickets()); }
    catch { this.cargando.set(false); this.error.set('No pudimos iniciar el panel. Revisa la configuración de Supabase.'); }
  }
}
