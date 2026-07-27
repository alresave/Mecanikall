import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';
import { Mecanico, OfertaTicket, Ticket, TicketConMecanico, TicketStatus } from '../../models';

type VistaSolicitud = 'formulario' | 'enviando' | 'buscando' | 'asignado';

@Component({
  selector: 'app-solicitud-ticket',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-dvh bg-slate-950 px-5 py-8 text-slate-50 sm:px-8">
      <section class="mx-auto w-full max-w-md">
        <header class="mb-8 flex items-center gap-3">
          <div class="grid size-11 place-items-center overflow-hidden rounded-lg shadow-lg shadow-black/20"><img src="mecanikall.png" alt="Mecanikall" class="size-11 object-cover" /></div>
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
              <label class="block text-sm font-medium">Vehículo
                <input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" formControlName="vehiculo" placeholder="Ej. Nissan Versa 2018" />
                @if (campoInvalido('vehiculo')) { <span class="mt-1 block text-xs text-red-300">Indica marca, modelo y año.</span> }
              </label>
              <label class="block text-sm font-medium">Motor o transmisión <span class="font-normal text-slate-400">(opcional)</span>
                <input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" formControlName="motor_transmision" placeholder="Ej. 1.6 automático" />
              </label>
              <fieldset class="block text-sm font-medium"><legend>¿El auto puede circular con seguridad?</legend><div class="mt-2 grid grid-cols-2 gap-3"><label class="rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-center"><input class="mr-2" type="radio" formControlName="puede_circular" value="yes" />Sí</label><label class="rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-center"><input class="mr-2" type="radio" formControlName="puede_circular" value="no" />No</label></div>@if (campoInvalido('puede_circular')) { <span class="mt-1 block text-xs text-red-300">Selecciona una opción.</span> }</fieldset>
              <button class="w-full rounded-xl bg-orange-500 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-orange-400 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50" type="submit" [disabled]="formulario.invalid">Obtener diagnóstico y solicitar ayuda</button>
            </form>
          </div>
        } @else if (vista() === 'enviando') {
          <div class="py-24 text-center"><div class="mx-auto size-14 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500"></div><h1 class="mt-7 text-xl font-bold">Enviando tu solicitud</h1><p class="mt-2 text-sm text-slate-400">Estamos preparando la búsqueda.</p></div>
        } @else if (vista() === 'buscando') {
          <div class="rounded-3xl border border-slate-700 bg-slate-800 p-7 text-center"><div class="mx-auto grid size-16 place-items-center rounded-full bg-orange-500/15 text-3xl text-orange-400">⌁</div><p class="mt-6 text-xs font-bold tracking-[.2em] text-orange-400">SOLICITUD ABIERTA</p><h1 class="mt-3 text-2xl font-bold">Compara las ofertas</h1><p class="mt-3 leading-6 text-slate-400">Los talleres cercanos enviarán precio y tiempo estimado.</p>@if (!ofertas().length) { <div class="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs text-slate-300"><span class="size-2 animate-pulse rounded-full bg-orange-500"></span> Esperando ofertas</div> } @else { <div class="mt-6 space-y-3 text-left">@for (oferta of ofertas(); track oferta.id_oferta) { <article class="rounded-xl border border-slate-600 bg-slate-900 p-4"><div class="flex justify-between gap-3"><div><p class="font-bold">{{ oferta.nombre_taller }}</p><p class="mt-1 text-xs text-slate-400">{{ oferta.especialidades.join(', ') || 'Servicio mecánico' }}</p></div><p class="font-bold text-orange-400">{{ oferta.precio_estimado | currency:'MXN':'symbol-narrow':'1.0-2' }}</p></div><p class="mt-3 text-sm text-slate-300">Llega aprox. en {{ oferta.tiempo_estimado_minutos }} min</p>@if (oferta.mensaje) { <p class="mt-2 text-sm text-slate-400">{{ oferta.mensaje }}</p> }<button type="button" class="mt-4 w-full rounded-lg bg-orange-500 px-3 py-2.5 font-bold text-slate-950 disabled:opacity-50" [disabled]="seleccionandoOferta() === oferta.id_oferta" (click)="aceptarOferta(oferta)">{{ seleccionandoOferta() === oferta.id_oferta ? 'Confirmando…' : 'Elegir esta oferta' }}</button></article> }</div> }<button type="button" class="mt-6 text-sm font-medium text-slate-400 underline hover:text-red-300 disabled:opacity-50" [disabled]="cancelando()" (click)="cancelar()">{{ cancelando() ? 'Cancelando…' : 'Cancelar solicitud' }}</button></div>
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
  private canalOfertas: RealtimeChannel | null = null;

  readonly vista = signal<VistaSolicitud>('formulario');
  readonly error = signal<string | null>(null);
  readonly mecanico = signal<Pick<Mecanico, 'nombre_taller' | 'whatsapp_destino'> | null>(null);
  readonly idTicket = signal<number | null>(null);
  readonly cancelando = signal(false);
  readonly ofertas = signal<OfertaTicket[]>([]);
  readonly seleccionandoOferta = signal<number | null>(null);
  readonly formulario = this.fb.nonNullable.group({
    nombre_completo: ['', [Validators.required, Validators.minLength(2)]],
    telefono_whatsapp: ['', [Validators.required, Validators.pattern(/^\D*(?:\d\D*){10}$/)]],
    ubicacion_auto: ['', [Validators.required, Validators.minLength(3)]],
    descripcion_falla: ['', [Validators.required, Validators.minLength(10)]],
    vehiculo: ['', [Validators.required, Validators.minLength(5)]],
    motor_transmision: [''],
    puede_circular: ['', Validators.required],
  });

  constructor() { this.destroyRef.onDestroy(() => { void this.supabase.cancelarSuscripcion(this.canal); void this.supabase.cancelarSuscripcion(this.canalOfertas); }); }

  campoInvalido(nombre: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[nombre];
    return control.invalid && (control.touched || control.dirty);
  }

  async enviar(): Promise<void> {
    if (this.formulario.invalid) { this.formulario.markAllAsTouched(); return; }
    this.error.set(null); this.vista.set('enviando');
    try {
      const valores = this.formulario.getRawValue();
      const coordenadas = await this.obtenerUbicacionActual();
      const diagnostico = await this.supabase.generarPrediagnostico({
        vehiculo: valores.vehiculo,
        motorTransmision: valores.motor_transmision,
        sintoma: valores.descripcion_falla,
        puedeCircular: valores.puede_circular as 'yes' | 'no',
      });
      const descripcionDetallada = [
        `Vehículo: ${valores.vehiculo}.`,
        valores.motor_transmision ? `Motor/transmisión: ${valores.motor_transmision}.` : '',
        `Puede circular: ${valores.puede_circular === 'yes' ? 'Sí' : 'No'}.`,
        `Falla reportada: ${valores.descripcion_falla}`,
        diagnostico.readyForDiagnosis ? `\n\nPRE-DIAGNÓSTICO MECANIKALL AI\n${diagnostico.reply}` : '',
      ].filter(Boolean).join('\n');
      const ticket = await this.supabase.solicitarAyuda({ ...valores, descripcion_falla: descripcionDetallada, prediagnostico: diagnostico.diagnostic, ...coordenadas });
      this.idTicket.set(ticket.id_ticket);
      this.vista.set('buscando');
      this.canal = this.supabase.suscribirATicket(ticket.id_ticket, (actualizado) => void this.procesarActualizacion(actualizado), () => this.error.set('Se perdió la conexión en tiempo real. Intenta recargar la página.'));
      await this.cargarOfertas(ticket.id_ticket);
      this.canalOfertas = this.supabase.suscribirAOfertas(ticket.id_ticket, () => void this.cargarOfertas(ticket.id_ticket));
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
      await this.supabase.cancelarSuscripcion(this.canalOfertas);
      this.canal = null;
      this.canalOfertas = null;
      this.idTicket.set(null);
      this.ofertas.set([]);
      this.formulario.reset();
      this.vista.set('formulario');
      this.error.set('La solicitud fue cancelada.');
    } catch { this.error.set('No fue posible cancelar la solicitud; quizá ya fue aceptada.'); }
    finally { this.cancelando.set(false); }
  }

  async aceptarOferta(oferta: OfertaTicket): Promise<void> {
    this.seleccionandoOferta.set(oferta.id_oferta);
    try {
      const ticket = await this.supabase.aceptarOferta(oferta.id_oferta);
      await this.procesarActualizacion(ticket);
    }
    catch (error) { this.error.set(this.mensajeError(error)); await this.cargarOfertas(oferta.id_ticket); }
    finally { this.seleccionandoOferta.set(null); }
  }

  private async procesarActualizacion(ticket: Ticket): Promise<void> {
    if (ticket.estatus !== TicketStatus.Asignado && !ticket.id_mecanico_asignado) return;
    try {
      const detalle: TicketConMecanico = await this.supabase.obtenerTicket(ticket.id_ticket);
      if (detalle.mecanico) { this.mecanico.set(detalle.mecanico); this.vista.set('asignado'); await this.supabase.cancelarSuscripcion(this.canal); await this.supabase.cancelarSuscripcion(this.canalOfertas); this.canal = null; this.canalOfertas = null; }
    } catch { this.error.set('El taller fue asignado, pero no pudimos cargar sus datos. Intenta recargar.'); }
  }

  private mensajeError(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'No pudimos enviar tu solicitud. Verifica tu conexión e inténtalo de nuevo.';
  }

  private async cargarOfertas(idTicket: number): Promise<void> {
    try { this.ofertas.set(await this.supabase.obtenerOfertasParaCliente(idTicket)); }
    catch { this.error.set('No pudimos actualizar las ofertas. Intenta recargar la página.'); }
  }

  /** Solicita la posición precisa del auto; el navegador exige HTTPS y consentimiento. */
  private obtenerUbicacionActual(): Promise<{ latitud: number; longitud: number }> {
    if (!navigator.geolocation) {
      return Promise.reject(new Error('Tu navegador no permite obtener la ubicación.'));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitud: coords.latitude, longitud: coords.longitude }),
        () => reject(new Error('Necesitamos tu ubicación para encontrar mecánicos cercanos. Activa el permiso e inténtalo de nuevo.')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }
}
