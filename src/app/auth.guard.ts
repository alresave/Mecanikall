import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './services/supabase.service';

export const tallerGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  try {
    return (await supabase.obtenerUsuarioActual()) ? true : router.createUrlTree(['/acceso']);
  } catch {
    return router.createUrlTree(['/acceso']);
  }
};
