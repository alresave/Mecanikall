import { Routes } from '@angular/router';
import { SolicitudTicketComponent } from './components/solicitud-ticket/solicitud-ticket.component';
import { PanelTallerComponent } from './components/panel-taller/panel-taller.component';
import { AccesoTallerComponent } from './components/acceso-taller/acceso-taller.component';
import { PanelAdminComponent } from './components/panel-admin/panel-admin.component';
import { PanelRefaccionesComponent } from './components/panel-refacciones/panel-refacciones.component';
import { ReporteSuscripcionesComponent } from './components/reporte-suscripciones/reporte-suscripciones.component';
import { OperacionEntidadesComponent } from './components/operacion-entidades/operacion-entidades.component';
import { tallerGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', component: SolicitudTicketComponent, title: 'Mecanikall | Solicitar ayuda' },
  { path: 'acceso', component: AccesoTallerComponent, title: 'Mecanikall | Acceso de talleres' },
  { path: 'taller', component: PanelTallerComponent, canActivate: [tallerGuard], title: 'Mecanikall | Panel de talleres' },
  { path: 'admin', component: PanelAdminComponent, canActivate: [tallerGuard], title: 'Mecanikall | Administración' },
  { path: 'refacciones', component: PanelRefaccionesComponent, canActivate: [tallerGuard], title: 'Mecanikall | Refacciones' },
  { path: 'reportes', component: ReporteSuscripcionesComponent, canActivate: [tallerGuard], title: 'Mecanikall | Prospectos' },
  { path: 'operacion', component: OperacionEntidadesComponent, canActivate: [tallerGuard], title: 'Mecanikall | Operación' },
  { path: '**', redirectTo: '' },
];
