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
      continuarDiagnostico: vi.fn().mockResolvedValue({ sessionId: 'sesion-ia-123', reply: 'No lo conduzcas hasta revisarlo.', readyForDiagnosis: true, diagnostic: { urgency: 'high', possibleCauses: ['Frenos'], estimatedCostMxn: '$2,000', nextStep: 'Solicita grúa' } }),
      generarPrediagnostico: vi.fn().mockResolvedValue({
        readyForDiagnosis: true,
        reply: 'Prediagnóstico listo.',
        diagnostic: { urgency: 'medium', possibleCauses: ['Balatas'], estimatedCostMxn: '$1,000', nextStep: 'Revisión' },
      }),
      obtenerOfertasParaCliente: vi.fn().mockResolvedValue([]),
      obtenerTicket: vi.fn().mockResolvedValue({ ...ticketAsignado, mecanico: { nombre_taller: 'Taller Norte', whatsapp_destino: '5512345678' } }),
      solicitarAyuda: vi.fn().mockResolvedValue(ticketAbierto),
      subirEvidenciaTicket: vi.fn().mockResolvedValue(undefined),
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

  it('permanece en el formulario y no llama a IA si se deniega la ubicación', async () => {
    establecerUbicacionDenegada();
    completarFormulario(component);

    await component.enviar();

    expect(service['generarPrediagnostico']).not.toHaveBeenCalled();
    expect(service['solicitarAyuda']).not.toHaveBeenCalled();
    expect(component.vista()).toBe('formulario');
    expect(component.error()).toContain('ubicación');
  });

  it('envía la solicitud aunque falle el pre-diagnóstico de IA', async () => {
    establecerUbicacionExitosa();
    completarFormulario(component);
    service['generarPrediagnostico'].mockRejectedValueOnce(new Error('IA no disponible'));

    await component.enviar();

    expect(service['solicitarAyuda']).toHaveBeenCalledWith(expect.objectContaining({ prediagnostico: null }));
    expect(component.vista()).toBe('buscando');
    expect(component.aviso()).toContain('pre-diagnóstico');
  });

  it('conserva la solicitud si falla la carga de adjuntos', async () => {
    establecerUbicacionExitosa();
    completarFormulario(component);
    service['subirEvidenciaTicket'].mockRejectedValueOnce(new Error('storage no disponible'));
    const archivo = new File(['foto'], 'tablero.jpg', { type: 'image/jpeg' });
    component.evidencia.set([{ archivo, nombre: archivo.name, url: 'blob:foto', esImagen: true }]);

    await component.enviar();

    expect(service['subirEvidenciaTicket']).toHaveBeenCalledWith(31, [archivo]);
    expect(component.vista()).toBe('buscando');
    expect(component.aviso()).toContain('adjuntar');
  });

  it('continúa el diagnóstico con el contexto y la nueva pregunta del cliente', async () => {
    component.sesionIa.set('sesion-ia-123');
    component.conversacionIa.set([{ role: 'assistant', content: '¿Puedes describir el ruido?' }]);
    component.preguntaIa.set('También se enciende el testigo de frenos.');

    await component.continuarDiagnostico();

    expect(service['continuarDiagnostico']).toHaveBeenCalledWith('sesion-ia-123', [
      { role: 'assistant', content: '¿Puedes describir el ruido?' },
      { role: 'user', content: 'También se enciende el testigo de frenos.' },
    ]);
    expect(component.conversacionIa().at(-1)?.content).toContain('No lo conduzcas');
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

function establecerUbicacionDenegada(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code: 1, message: 'Permission denied' } as GeolocationPositionError) },
  });
}
