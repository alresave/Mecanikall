import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-acceso-taller',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="grid min-h-dvh place-items-center bg-slate-950 px-5 py-8 text-slate-50">
      <section class="w-full max-w-md"><a routerLink="/" class="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-orange-400">← Volver a solicitud</a>
        <div class="rounded-3xl border border-slate-700 bg-slate-800 p-6 shadow-2xl shadow-black/30"><div class="grid size-12 place-items-center rounded-lg border border-slate-700" style="background-color: #111827"><img src="logo.png" alt="Mecanikall" class="size-11 object-contain" /></div><p class="mt-6 text-xs font-bold tracking-[.2em] text-orange-400">ACCESO PARA TALLERES</p><h1 class="mt-2 text-2xl font-bold">Bienvenido de vuelta</h1><p class="mt-2 text-sm leading-6 text-slate-400">Ingresa con la cuenta asociada a tu taller.</p>
          @if (error()) { <p role="alert" class="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{{ error() }}</p> }
          <form class="mt-7 space-y-5" [formGroup]="formulario" (ngSubmit)="ingresar()"><label class="block text-sm font-medium">Correo electrónico<input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-500" formControlName="email" type="email" autocomplete="email" placeholder="taller@ejemplo.com"></label><label class="block text-sm font-medium">Contraseña<input class="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-orange-500" formControlName="password" type="password" autocomplete="current-password" placeholder="••••••••"></label><button class="w-full rounded-xl bg-orange-500 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50" type="submit" [disabled]="formulario.invalid || enviando()">{{ enviando() ? 'Ingresando…' : 'Ingresar al panel' }}</button></form>
        </div>
      </section>
    </main>
  `,
})
export class AccesoTallerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly formulario = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });

  async ingresar(): Promise<void> {
    if (this.formulario.invalid) { this.formulario.markAllAsTouched(); return; }
    this.enviando.set(true); this.error.set(null);
    try { await this.supabase.iniciarSesion(this.formulario.getRawValue().email, this.formulario.getRawValue().password); await this.router.navigateByUrl('/taller'); }
    catch { this.error.set('No pudimos iniciar sesión. Verifica tus credenciales.'); }
    finally { this.enviando.set(false); }
  }
}
