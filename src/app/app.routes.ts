import { Routes } from '@angular/router';
import { SolicitudTicketComponent } from './components/solicitud-ticket/solicitud-ticket.component';
import { PanelTallerComponent } from './components/panel-taller/panel-taller.component';
import { AccesoTallerComponent } from './components/acceso-taller/acceso-taller.component';
import { tallerGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', component: SolicitudTicketComponent, title: 'Mecanikall | Solicitar ayuda' },
  { path: 'acceso', component: AccesoTallerComponent, title: 'Mecanikall | Acceso de talleres' },
  { path: 'taller', component: PanelTallerComponent, canActivate: [tallerGuard], title: 'Mecanikall | Panel de talleres' },
  { path: '**', redirectTo: '' },
];
