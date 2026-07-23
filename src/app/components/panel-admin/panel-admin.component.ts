import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-panel-admin', standalone: true, imports: [ReactiveFormsModule, RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="min-h-dvh bg-slate-950 px-5 py-8 text-slate-50"><section class="mx-auto max-w-lg"><div class="flex items-center justify-between gap-4"><a routerLink="/taller" class="text-sm text-orange-400">← Panel de taller</a><button type="button" class="text-sm text-slate-400 hover:text-slate-50" (click)="salir()">Cerrar sesión</button></div><h1 class="mt-6 text-2xl font-bold">Administración de talleres</h1>
  @if (error()) { <p class="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{{ error() }}</p> }
  @if (!esAdmin()) { <div class="mt-6 rounded-2xl border border-slate-700 bg-slate-800 p-5"><p class="text-sm text-slate-300">Esta cuenta aún no tiene permisos administrativos.</p><button class="mt-4 rounded-lg bg-orange-500 px-4 py-2 font-bold text-slate-950" [disabled]="activando()" (click)="activarAdmin()">{{ activando() ? 'Activando…' : 'Activar como administrador inicial' }}</button><div class="mt-5 flex gap-4"><button type="button" class="text-sm text-orange-400 hover:text-orange-300" (click)="irAlAcceso()">Iniciar con otra cuenta</button><button type="button" class="text-sm text-slate-400 hover:text-slate-50" (click)="salir()">Cerrar sesión</button></div></div> }
  @else { <form class="mt-6 space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5" [formGroup]="formulario" (ngSubmit)="crear()"><p class="font-bold">Registrar nuevo taller</p><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="nombre_taller" placeholder="Nombre del taller" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="email" type="email" placeholder="Correo de acceso" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="password" type="password" placeholder="Contraseña temporal (mín. 8)" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="whatsapp_destino" placeholder="WhatsApp" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="zona_cobertura" placeholder="Zona de cobertura" /><input class="w-full rounded-lg bg-slate-900 p-3" formControlName="especialidades" placeholder="Especialidades separadas por coma" /><button class="w-full rounded-lg bg-orange-500 p-3 font-bold text-slate-950 disabled:opacity-50" [disabled]="formulario.invalid || creando()">{{ creando() ? 'Creando…' : 'Crear taller pendiente' }}</button></form> }
  </section></main>`,
})
export class PanelAdminComponent {
  private readonly supabase = inject(SupabaseService); private readonly fb = inject(FormBuilder); private readonly router = inject(Router);
  readonly esAdmin = signal(false); readonly activando = signal(false); readonly creando = signal(false); readonly error = signal<string | null>(null);
  readonly formulario = this.fb.nonNullable.group({ nombre_taller: ['', Validators.required], email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, Validators.minLength(8)]], whatsapp_destino: ['', Validators.required], zona_cobertura: ['', Validators.required], especialidades: [''] });
  constructor() { void this.cargarPermisos(); }
  async activarAdmin(): Promise<void> { this.activando.set(true); try { await this.supabase.activarAdministradorInicial(); await this.cargarPermisos(); } catch { this.error.set('Esta cuenta no coincide con el administrador inicial configurado.'); } finally { this.activando.set(false); } }
  async crear(): Promise<void> { if (this.formulario.invalid) return; this.creando.set(true); this.error.set(null); try { const v = this.formulario.getRawValue(); await this.supabase.crearMecanicoAdministrativo({ ...v, especialidades: v.especialidades.split(',').map((x) => x.trim()).filter(Boolean) }); this.formulario.reset(); } catch { this.error.set('No fue posible crear el taller. Verifica que el correo no esté registrado.'); } finally { this.creando.set(false); } }
  async salir(): Promise<void> { await this.supabase.cerrarSesion(); await this.router.navigateByUrl('/acceso'); }
  async irAlAcceso(): Promise<void> { await this.salir(); }
  private async cargarPermisos(): Promise<void> { try { this.esAdmin.set(await this.supabase.esAdministrador()); } catch { this.error.set('Inicia sesión para acceder a administración.'); } }
}
