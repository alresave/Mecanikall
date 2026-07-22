import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';
import { Mecanico, Ticket, TicketConMecanico, TicketStatus } from '../../models';

type VistaSolicitud = 'formulario' | 'enviando' | 'buscando' | 'asignado';

@Component({
  selector: 'app-solicitud-ticket',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-dvh bg-slate-950 px-5 py-8 text-slate-50 sm:px-8">
      <section class="mx-auto w-full max-w-md">
        <header class="mb-8 flex items-center gap-3">
          <div class="grid size-11 place-items-center rounded-lg border border-slate-700 shadow-lg shadow-black/20" style="background-color: #111827"><img src="logo.png" alt="Mecanikall" class="size-10 object-contain" /></div>
          <div><p class="text-lg font-bold tracking-tight">Mecanikall</p><p class="text-xs text-slate-400">Asistencia mecánica confiable</p></div>
        </header>

        @if (error()) {
          <div role="alert" class="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{{ error() }}</div>
        }

        @if (vista() === 'formulario') {
          <div class="rounded-3xl border border-slate-700/70 bg-slate-800 p-5 shadow-2xl shadow-black/30">
            <p class="text-sm font-medium text-orange-400">REPORTA TU FALLA</p>
            <h1 class="mt-2 text-2xl font-bold tracking-tight">Te conectamos con ayuda cerca de ti.</h1>
            <p class="mt-2 text-sm leading-6 text-slate-400">Cuéntanos qué ocurre. Tardarás menos de un minuto.</p>
            <form class="mt-7 space-y-5" [formGroup]="formulario" (ngSubmit)="enviar()">
              <label class="block text-sm font-medium">Nombre completo
                <input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" formControlName="nombre_completo" autocomplete="name" placeholder="¿Cómo te llamas?" />
                @if (campoInvalido('nombre_completo')) { <span class="mt-1 block text-xs text-red-300">Escribe tu nombre.</span> }
              </label>
              <label class="block text-sm font-medium">WhatsApp
                <input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" formControlName="telefono_whatsapp" inputmode="numeric" autocomplete="tel" placeholder="10 dígitos" />
                @if (campoInvalido('telefono_whatsapp')) { <span class="mt-1 block text-xs text-red-300">Ingresa un teléfono válido de 10 dígitos.</span> }
              </label>
              <label class="block text-sm font-medium">¿Dónde está tu auto?
                <input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" formControlName="ubicacion_auto" autocomplete="street-address" placeholder="Colonia, calle o referencia" />
                @if (campoInvalido('ubicacion_auto')) { <span class="mt-1 block text-xs text-red-300">Indica una ubicación o zona.</span> }
              </label>
              <label class="block text-sm font-medium">¿Qué falla presenta?
                <textarea class="mt-2 min-h-28 w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" formControlName="descripcion_falla" placeholder="Ej. El coche desboca y rechina al frenar."></textarea>
                @if (campoInvalido('descripcion_falla')) { <span class="mt-1 block text-xs text-red-300">Describe la falla para encontrar al especialista indicado.</span> }
              </label>
              <button class="w-full rounded-xl bg-orange-500 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-orange-400 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50" type="submit" [disabled]="formulario.invalid">Solicitar ayuda</button>
            </form>
          </div>
        } @else if (vista() === 'enviando') {
          <div class="py-24 text-center"><div class="mx-auto size-14 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500"></div><h1 class="mt-7 text-xl font-bold">Enviando tu solicitud</h1><p class="mt-2 text-sm text-slate-400">Estamos preparando la búsqueda.</p></div>
        } @else if (vista() === 'buscando') {
          <div class="rounded-3xl border border-slate-700 bg-slate-800 p-7 text-center"><div class="mx-auto grid size-16 place-items-center rounded-full bg-orange-500/15 text-3xl text-orange-400">⌁</div><p class="mt-6 text-xs font-bold tracking-[.2em] text-orange-400">SOLICITUD ABIERTA</p><h1 class="mt-3 text-2xl font-bold">Buscando mecánicos cerca de ti</h1><p class="mt-3 leading-6 text-slate-400">Tu reporte fue enviado. Te avisaremos en cuanto un taller lo acepte.</p><div class="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs text-slate-300"><span class="size-2 animate-pulse rounded-full bg-orange-500"></span> Conectado en tiempo real</div><button type="button" class="mt-6 text-sm font-medium text-slate-400 underline hover:text-red-300 disabled:opacity-50" [disabled]="cancelando()" (click)="cancelar()">{{ cancelando() ? 'Cancelando…' : 'Cancelar solicitud' }}</button></div>
        } @else {
          <div class="rounded-3xl border border-orange-400/30 bg-slate-800 p-7 text-center shadow-xl shadow-orange-950/20"><div class="mx-auto grid size-16 place-items-center rounded-full bg-orange-500 text-3xl text-slate-950">✓</div><p class="mt-6 text-xs font-bold tracking-[.2em] text-orange-400">AYUDA EN CAMINO</p><h1 class="mt-3 text-2xl font-bold">{{ mecanico()?.nombre_taller }}</h1><p class="mt-3 text-sm leading-6 text-slate-400">Aceptó tu solicitud. Escríbele para coordinar la atención.</p><a class="mt-7 block w-full rounded-xl bg-orange-500 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-orange-400" [href]="whatsappUrl()" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div>
        }
      </section>
    </main>
  `,
})
export class SolicitudTicketComponent {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);
  private canal: RealtimeChannel | null = null;

  readonly vista = signal<VistaSolicitud>('formulario');
  readonly error = signal<string | null>(null);
  readonly mecanico = signal<Pick<Mecanico, 'nombre_taller' | 'whatsapp_destino'> | null>(null);
  readonly idTicket = signal<number | null>(null);
  readonly cancelando = signal(false);
  readonly formulario = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(2)]],
    telefono_whatsapp: ['', [Validators.required, Validators.pattern(/^\D*(?:\d\D*){10}$/)]],
    ubicacion_auto: ['', [Validators.required, Validators.minLength(3)]],
    descripcion_falla: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() { this.destroyRef.onDestroy(() => void this.supabase.cancelarSuscripcion(this.canal)); }

  campoInvalido(nombre: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[nombre];
    return control.invalid && (control.touched || control.dirty);
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid) { this.formulario.markAllAsTouched(); return; }
    this.error.set(null); this.vista.set('enviando');
    try {
      const valores = this.formulario.getRawValue();
      const ticket = await this.supabase.solicitarAyuda(valores);
      this.idTicket.set(ticket.id_ticket);
      this.vista.set('buscando');
      this.canal = this.supabase.suscribirATicket(ticket.id_ticket, (actualizado) => void this.procesarActualizacion(actualizado), () => this.error.set('Se perdió la conexión en tiempo real. Intenta recargar la página.'));
    } catch (err) {
      this.vista.set('formulario');
      this.error.set(this.mensajeError(err));
    }
  }

  whatsappUrl(): string {
    const telefono = this.mecanico()?.whatsapp_destino.replace(/\D/g, '') ?? '';
    return `https://wa.me/${telefono}?text=${encodeURIComponent('Hola, vi que aceptaste mi solicitud en Mecanikall.')}`;
  }

  async cancelar(): Promise<void> {
    const idTicket = this.idTicket();
    if (!idTicket) return;
    this.cancelando.set(true);
    try {
      await this.supabase.cancelarTicket(idTicket);
      await this.supabase.cancelarSuscripcion(this.canal);
      this.canal = null;
      this.idTicket.set(null);
      this.formulario.reset();
      this.vista.set('formulario');
      this.error.set('La solicitud fue cancelada.');
    } catch { this.error.set('No fue posible cancelar la solicitud; quizá ya fue aceptada.'); }
    finally { this.cancelando.set(false); }
  }

  private async procesarActualizacion(ticket: Ticket): Promise<void> {
    if (ticket.estatus !== TicketStatus.Asignado && !ticket.id_mecanico_asignado) return;
    try {
      const detalle: TicketConMecanico = await this.supabase.obtenerTicket(ticket.id_ticket);
      if (detalle.mecanico) { this.mecanico.set(detalle.mecanico); this.vista.set('asignado'); await this.supabase.cancelarSuscripcion(this.canal); this.canal = null; }
    } catch { this.error.set('El taller fue asignado, pero no pudimos cargar sus datos. Intenta recargar.'); }
  }

  private mensajeError(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'No pudimos enviar tu solicitud. Verifica tu conexión e inténtalo de nuevo.';
  }
}
