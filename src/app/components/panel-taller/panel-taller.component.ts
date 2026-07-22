import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Mecanico, TicketConCliente } from '../../models';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-panel-taller',
  standalone: true,
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-dvh bg-slate-950 px-5 py-8 text-slate-50 sm:px-8">
      <section class="mx-auto w-full max-w-3xl">
        <header class="mb-8 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3"><div class="grid size-11 place-items-center rounded-xl bg-slate-900"><img src="logo.png" alt="Mecanikall" class="size-10 object-contain" /></div><div><p class="text-lg font-bold tracking-tight">Mecanikall</p><p class="text-xs text-slate-400">Panel de talleres</p></div></div>
          <div class="flex gap-4"><a routerLink="/" class="text-sm font-medium text-orange-400 hover:text-orange-300">Vista cliente</a><button type="button" class="text-sm font-medium text-slate-400 hover:text-slate-50" (click)="salir()">Salir</button></div>
        </header>

        @if (error()) { <p role="alert" class="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{{ error() }}</p> }

        <div class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <p class="text-xs font-bold tracking-[.2em] text-orange-400">TALLER ACTIVO</p>
          <p class="mt-2 text-lg font-bold">{{ taller()?.nombre_taller ?? 'Cargando taller…' }}</p>
          <p class="mt-1 text-sm text-slate-400">{{ taller()?.zona_cobertura }}</p>
        </div>

        <div class="mt-8 flex items-end justify-between gap-4"><div><p class="text-xs font-bold tracking-[.2em] text-orange-400">SOLICITUDES DISPONIBLES</p><h1 class="mt-2 text-2xl font-bold">Servicios cerca de ti</h1></div><button type="button" class="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-orange-400 hover:text-orange-400" (click)="cargarTickets()">Actualizar</button></div>

        @if (cargando()) { <div class="py-16 text-center text-sm text-slate-400">Cargando solicitudes…</div> }
        @else if (!taller()) { <div class="mt-5 rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-400">Esta cuenta no está asociada a un taller activo. Pide al administrador que la vincule.</div> }
        @else if (!tickets().length) { <div class="mt-5 rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-400">No hay solicitudes abiertas por el momento.</div> }
        @else { <div class="mt-5 grid gap-4 md:grid-cols-2">
          @for (ticket of tickets(); track ticket.id_ticket) {
            <article class="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-lg shadow-black/20">
              <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">{{ ticket.cliente?.nombre_completo ?? 'Cliente' }}</p><p class="mt-1 text-xs text-slate-400">{{ ticket.created_at | date:'short' }}</p></div><span class="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-400">Abierto</span></div>
              <dl class="mt-5 space-y-4 text-sm"><div><dt class="text-xs font-bold tracking-wide text-slate-500">UBICACIÓN</dt><dd class="mt-1 text-slate-200">{{ ticket.ubicacion_auto }}</dd></div><div><dt class="text-xs font-bold tracking-wide text-slate-500">FALLA REPORTADA</dt><dd class="mt-1 leading-6 text-slate-300">{{ ticket.descripcion_falla }}</dd></div></dl>
              <a class="mt-5 inline-block text-sm text-orange-400 hover:text-orange-300" [href]="whatsappCliente(ticket)" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>
              <button type="button" class="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50" [disabled]="aceptando() === ticket.id_ticket" (click)="aceptar(ticket)">{{ aceptando() === ticket.id_ticket ? 'Aceptando…' : 'Aceptar servicio' }}</button>
            </article>
          }
        </div> }

        <div class="mt-10"><p class="text-xs font-bold tracking-[.2em] text-orange-400">SERVICIOS ASIGNADOS</p><h2 class="mt-2 text-xl font-bold">En atención</h2>
          @if (!asignados().length) { <p class="mt-4 text-sm text-slate-400">No tienes servicios asignados.</p> }
          @else { <div class="mt-4 grid gap-4 md:grid-cols-2">@for (ticket of asignados(); track ticket.id_ticket) {
            <article class="rounded-2xl border border-slate-700 bg-slate-800 p-5"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold">{{ ticket.cliente?.nombre_completo ?? 'Cliente' }}</p><p class="mt-1 text-xs text-slate-400">{{ ticket.ubicacion_auto }}</p></div><span class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">Asignado</span></div><p class="mt-4 text-sm leading-6 text-slate-300">{{ ticket.descripcion_falla }}</p><a class="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300" [href]="whatsappCliente(ticket)" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a><button type="button" class="mt-4 w-full rounded-xl border border-emerald-400/50 px-4 py-3 font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50" [disabled]="concluyendo() === ticket.id_ticket" (click)="concluir(ticket)">{{ concluyendo() === ticket.id_ticket ? 'Concluyendo…' : 'Marcar como concluido' }}</button></article>
          }</div> }
        </div>
      </section>
    </main>
  `,
})
export class PanelTallerComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private canal: RealtimeChannel | null = null;

  readonly taller = signal<Mecanico | null>(null);
  readonly tickets = signal<TicketConCliente[]>([]);
  readonly asignados = signal<TicketConCliente[]>([]);
  readonly cargando = signal(true);
  readonly aceptando = signal<number | null>(null);
  readonly concluyendo = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.inicializar();
    this.destroyRef.onDestroy(() => void this.supabase.cancelarSuscripcion(this.canal));
  }

  async cargarTickets(): Promise<void> {
    this.cargando.set(true);
    try { const [abiertos, asignados] = await Promise.all([this.supabase.obtenerTicketsAbiertos(), this.supabase.obtenerMisTicketsAsignados()]); this.tickets.set(abiertos); this.asignados.set(asignados); this.error.set(null); }
    catch { this.error.set('No pudimos cargar las solicitudes. Revisa tu conexión y permisos.'); }
    finally { this.cargando.set(false); }
  }

  async aceptar(ticket: TicketConCliente): Promise<void> {
    if (!this.taller()) return;
    this.aceptando.set(ticket.id_ticket);
    try { await this.supabase.asignarTicket(ticket.id_ticket); await this.cargarTickets(); }
    catch { this.error.set('No fue posible aceptar el servicio. Puede que otro taller lo haya tomado.'); }
    finally { this.aceptando.set(null); }
  }

  async concluir(ticket: TicketConCliente): Promise<void> {
    this.concluyendo.set(ticket.id_ticket);
    try { await this.supabase.concluirTicket(ticket.id_ticket); await this.cargarTickets(); }
    catch { this.error.set('No fue posible concluir el servicio.'); }
    finally { this.concluyendo.set(null); }
  }

  whatsappCliente(ticket: TicketConCliente): string { return `https://wa.me/${ticket.cliente?.telefono_whatsapp.replace(/\\D/g, '') ?? ''}`; }

  async salir(): Promise<void> { await this.supabase.cerrarSesion(); await this.router.navigateByUrl('/acceso'); }

  private async inicializar(): Promise<void> {
    try { this.taller.set(await this.supabase.obtenerTallerActual()); await this.cargarTickets(); this.canal = this.supabase.suscribirATicketsAbiertos(() => void this.cargarTickets()); }
    catch { this.cargando.set(false); this.error.set('No pudimos iniciar el panel. Revisa la configuración de Supabase.'); }
  }
}
