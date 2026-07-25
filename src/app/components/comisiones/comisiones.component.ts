import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ComisionVendedor } from '../../models';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../services/notification.service';

@Component({ selector: 'app-comisiones', standalone: true, imports: [FormsModule, RouterLink, CurrencyPipe], changeDetection: ChangeDetectionStrategy.OnPush, template: `
<main class="min-h-dvh bg-slate-950 px-5 py-8 text-slate-50"><section class="mx-auto max-w-3xl">
  <a routerLink="/admin" class="text-sm text-orange-400">← Administración</a>
  <div class="mt-6 flex flex-wrap items-center justify-between gap-3"><h1 class="text-2xl font-bold">Comisiones de vendedores</h1>@if(esAdmin()){<button class="rounded border border-cyan-400 px-3 py-2 text-sm text-cyan-200" (click)="activarNotificaciones()">{{notificacionesActivas()?'Notificaciones activas':'Activar avisos push'}}</button>}</div>
  <p class="mt-2 text-sm text-slate-400">Se crean automáticamente cuando un taller asignado paga su primera suscripción.</p>
  @if(error()){<p class="mt-5 text-red-200">{{error()}}</p>}
  <div class="mt-6 grid gap-3">@for(c of comisiones();track c.id_comision){<article class="rounded-xl border border-slate-700 bg-slate-800 p-4">
    <div class="flex flex-wrap justify-between gap-3"><div><p class="font-bold">{{c.nombre_taller}}</p><p class="text-sm text-slate-400">Vendedor: {{c.vendedor_email}}</p><p class="text-sm text-emerald-300">Primer pago: {{c.importe_pago | currency:'MXN':'symbol-narrow'}}</p></div><span class="h-fit rounded-full px-3 py-1 text-sm" [class.bg-amber-400]="c.estatus==='Pendiente'" [class.text-slate-950]="c.estatus==='Pendiente'" [class.bg-emerald-500]="c.estatus==='Pagada'">{{c.estatus}}</span></div>
    @if(c.estatus==='Pendiente'&&esAdmin()){<div class="mt-4 flex gap-2"><input class="w-40 rounded bg-slate-900 p-2" type="number" min="0" step="0.01" placeholder="Comisión MXN" [(ngModel)]="importes[c.id_comision]"><button class="rounded bg-orange-500 px-3 font-bold text-slate-950" (click)="pagar(c)">Marcar pagada</button></div>} @else if(c.importe_comision!==null){<p class="mt-3 text-sm text-slate-300">Comisión pagada: {{c.importe_comision | currency:'MXN':'symbol-narrow'}}</p>}
  </article>}@empty{<p class="text-slate-400">No hay comisiones registradas.</p>}</div>
</section></main>` })
export class ComisionesComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly notifications = inject(NotificationService);
  readonly comisiones = signal<ComisionVendedor[]>([]); readonly error = signal<string | null>(null); readonly esAdmin = signal(false); readonly notificacionesActivas = signal(false);
  importes: Record<number, number | undefined> = {};
  constructor() { void this.cargar(); }
  async cargar() { try { const [rol, comisiones] = await Promise.all([this.supabase.obtenerRolBackoffice(), this.supabase.obtenerComisionesVendedores()]); this.esAdmin.set(rol === 'admin'); this.comisiones.set(comisiones); } catch { this.error.set('No tienes permisos para consultar las comisiones.'); } }
  async pagar(c: ComisionVendedor) { const importe = this.importes[c.id_comision]; if (importe === undefined || importe < 0) { this.error.set('Indica un importe de comisión válido.'); return; } try { await this.supabase.marcarComisionPagada(c.id_comision, importe); await this.cargar(); } catch { this.error.set('No fue posible marcar la comisión como pagada.'); } }
  async activarNotificaciones() { try { await this.notifications.activarNotificaciones(); this.notificacionesActivas.set(true); } catch { this.error.set('No fue posible activar los avisos push.'); } }
}
