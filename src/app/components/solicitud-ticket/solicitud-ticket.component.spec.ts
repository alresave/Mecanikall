import { TestBed } from '@angular/core/testing';
import { RealtimeChannel } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfertaTicket, Ticket, TicketStatus } from '../../models';
import { SupabaseService } from '../../services/supabase.service';
import { SolicitudTicketComponent } from './solicitud-ticket.component';

describe('SolicitudTicketComponent', () => {
  let component: SolicitudTicketComponent;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const ticketAbierto = { id_ticket: 31, estatus: TicketStatus.Abierto, id_mecanico_asignado: null } as Ticket;
  const ticketAsignado = { id_ticket: 31, estatus: TicketStatus.Asignado, id_mecanico_asignado: 9 } as Ticket;

  beforeEach(() => {
    service = {
      aceptarOferta: vi.fn().mockResolvedValue(ticketAsignado),
      cancelarSuscripcion: vi.fn().mockResolvedValue(undefined),
      generarPrediagnostico: vi.fn().mockResolvedValue({
        readyForDiagnosis: true,
        reply: 'Prediagnóstico listo.',
        diagnostic: { urgency: 'medium', possibleCauses: ['Balatas'], estimatedCostMxn: '$1,000', nextStep: 'Revisión' },
      }),
      obtenerOfertasParaCliente: vi.fn().mockResolvedValue([]),
      obtenerTicket: vi.fn().mockResolvedValue({ ...ticketAsignado, mecanico: { nombre_taller: 'Taller Norte', whatsapp_destino: '5512345678' } }),
      solicitarAyuda: vi.fn().mockResolvedValue(ticketAbierto),
      suscribirAOfertas: vi.fn().mockReturnValue({} as RealtimeChannel),
      suscribirATicket: vi.fn().mockReturnValue({} as RealtimeChannel),
    };
    TestBed.configureTestingModule({
      imports: [SolicitudTicketComponent],
      providers: [{ provide: SupabaseService, useValue: service }],
    });
    component = TestBed.createComponent(SolicitudTicketComponent).componentInstance;
  });

  it('no envía una solicitud si el formulario es inválido', async () => {
    await component.enviar();

    expect(service['solicitarAyuda']).not.toHaveBeenCalled();
    expect(component.formulario.controls.nombre_completo.touched).toBe(true);
    expect(component.vista()).toBe('formulario');
  });

  it('crea una solicitud válida y muestra la espera de ofertas', async () => {
    establecerUbicacionExitosa();
    completarFormulario(component);

    await component.enviar();

    expect(service['solicitarAyuda']).toHaveBeenCalledWith(expect.objectContaining({
      nombre_completo: 'Ana Pérez',
      latitud: 19.4326,
      longitud: -99.1332,
      prediagnostico: expect.objectContaining({ urgency: 'medium' }),
    }));
    expect(service['generarPrediagnostico']).toHaveBeenCalledWith(expect.objectContaining({
      observaciones: expect.stringContaining('Al frenar'),
    }));
    expect(component.idTicket()).toBe(31);
    expect(component.vista()).toBe('buscando');
    expect(service['suscribirATicket']).toHaveBeenCalledWith(31, expect.any(Function), expect.any(Function));
  });

  it('asigna el taller y habilita el contacto al aceptar una oferta', async () => {
    const oferta = { id_oferta: 7, id_ticket: 31 } as OfertaTicket;

    await component.aceptarOferta(oferta);

    expect(service['aceptarOferta']).toHaveBeenCalledWith(7);
    expect(component.vista()).toBe('asignado');
    expect(component.mecanico()?.nombre_taller).toBe('Taller Norte');
    expect(component.whatsappUrl()).toContain('5512345678');
  });
});

function completarFormulario(component: SolicitudTicketComponent): void {
  component.formulario.patchValue({
    nombre_completo: 'Ana Pérez',
    telefono_whatsapp: '5512345678',
    ubicacion_auto: 'Roma Norte',
    descripcion_falla: 'El auto vibra al frenar.',
    marca: 'Nissan',
  });
  component.alCambiarMarca();
  component.formulario.patchValue({
    modelo: 'Versa', anio: '2020', puede_circular: 'yes',
    momento_falla: 'Al frenar', senales_observadas: 'Vibración y rechinido metálico.', testigo_tablero: 'No',
    antecedentes_falla: 'Comenzó después de pasar un bache.',
  });
}

function establecerUbicacionExitosa(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 19.4326, longitude: -99.1332 } } as GeolocationPosition) },
  });
}
