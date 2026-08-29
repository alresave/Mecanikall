import { Routes } from '@angular/router';
import { tallerGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/solicitud-ticket/solicitud-ticket.component').then(m => m.SolicitudTicketComponent), title: 'Mecanikall | Solicitar ayuda' },
  { path: 'acceso', loadComponent: () => import('./components/acceso-taller/acceso-taller.component').then(m => m.AccesoTallerComponent), title: 'Mecanikall | Acceso de talleres' },
  { path: 'taller', loadComponent: () => import('./components/panel-taller/panel-taller.component').then(m => m.PanelTallerComponent), canActivate: [tallerGuard], title: 'Mecanikall | Panel de talleres' },
  { path: 'admin', loadComponent: () => import('./components/panel-admin/panel-admin.component').then(m => m.PanelAdminComponent), canActivate: [tallerGuard], title: 'Mecanikall | Administración' },
  { path: 'refacciones', loadComponent: () => import('./components/panel-refacciones/panel-refacciones.component').then(m => m.PanelRefaccionesComponent), canActivate: [tallerGuard], title: 'Mecanikall | Refacciones' },
  { path: 'reportes', loadComponent: () => import('./components/reporte-suscripciones/reporte-suscripciones.component').then(m => m.ReporteSuscripcionesComponent), canActivate: [tallerGuard], title: 'Mecanikall | Prospectos' },
  { path: 'conversion', loadComponent: () => import('./components/reporte-conversion/reporte-conversion.component').then(m => m.ReporteConversionComponent), canActivate: [tallerGuard], title: 'Mecanikall | Conversión' },
  { path: 'operacion', loadComponent: () => import('./components/operacion-entidades/operacion-entidades.component').then(m => m.OperacionEntidadesComponent), canActivate: [tallerGuard], title: 'Mecanikall | Operación' },
  { path: 'suscripcion', loadComponent: () => import('./components/suscripcion/suscripcion.component').then(m => m.SuscripcionComponent), canActivate: [tallerGuard], title: 'Mecanikall | Suscripción' },
  { path: 'comisiones', loadComponent: () => import('./components/comisiones/comisiones.component').then(m => m.ComisionesComponent), canActivate: [tallerGuard], title: 'Mecanikall | Comisiones' },
  { path: '**', redirectTo: '' },
];
