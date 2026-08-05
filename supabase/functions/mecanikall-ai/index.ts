/// <reference lib="deno.ns" />
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Webhook-ready AI orchestration for WhatsApp.
 * Required secrets: MECANIKALL_AI_SYSTEM_PROMPT, AI_PROVIDER (openai|anthropic),
 * OPENAI_API_KEY or ANTHROPIC_API_KEY.
 * Required webhook secret: MECANIKALL_AI_WEBHOOK_SECRET. Optional: AI_MODEL.
 */

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface AiRequest {
  sessionId: string;
  messages: ChatMessage[];
  ticketRequest?: TicketRequest;
}

interface TicketRequest {
  confirmed: boolean;
  customer: { name: string; phone: string };
  location: { reference: string; latitude: number; longitude: number };
}

interface AiResponse {
  reply: string;
  session: {
    vehicle: { brand: string | null; model: string | null; year: number | null; engineOrTransmission: string | null; engineKnown: boolean };
    symptom: string | null;
    drivable: 'yes' | 'no' | 'unknown';
    collected: { vehicle: boolean; engineOrTransmission: boolean; symptom: boolean; drivable: boolean };
  };
  readyForDiagnosis: boolean;
  nextRequiredField: 'vehicle' | 'engineOrTransmission' | 'symptom' | 'drivable' | null;
  diagnostic: { urgency: 'low' | 'medium' | 'high' | null; possibleCauses: string[]; estimatedCostMxn: string | null; nextStep: string | null };
}

interface CreatedTicket { id_ticket: number; }

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_BODY_BYTES = 64_000;
const DISCLAIMER = 'Este es un pre-diagnóstico basado en IA. Requiere inspección física con escáner por un técnico certificado.';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' };

function systemPrompt(): string {
  // Environment storage makes the prompt available after Supabase bundles the function.
  const prompt = Deno.env.get('MECANIKALL_AI_SYSTEM_PROMPT');
  if (!prompt) throw new Error('Falta MECANIKALL_AI_SYSTEM_PROMPT. Carga el contenido de system_prompt.txt como secreto.');
  return prompt;
}

function errorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: jsonHeaders });
}

/** Accepts either the WhatsApp webhook secret or an authenticated Supabase user.
 * The latter is used by the web ticket form; keeping this verification here avoids
 * ever exposing the webhook secret to a browser.
 */
async function authorized(request: Request): Promise<boolean> {
  const webhookSecret = Deno.env.get('MECANIKALL_AI_WEBHOOK_SECRET');
  if (webhookSecret && request.headers.get('x-webhook-secret') === webhookSecret) return true;

  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!token || !url || !anonKey) return false;

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

function isAiRequest(value: unknown): value is AiRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<AiRequest>;
  return typeof request.sessionId === 'string' && request.sessionId.length >= 8 && request.sessionId.length <= 128 &&
    Array.isArray(request.messages) && request.messages.length > 0 && request.messages.length <= MAX_MESSAGES &&
    request.messages.every((message) => message && (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string' && message.content.trim().length > 0 && message.content.length <= MAX_MESSAGE_LENGTH);
}

function validTicketRequest(value: TicketRequest | undefined): value is TicketRequest {
  if (!value?.confirmed) return false;
  const { customer, location } = value;
  return typeof customer?.name === 'string' && customer.name.trim().length >= 2 && customer.name.length <= 120 &&
    typeof customer.phone === 'string' && /^\D*(?:\d\D*){10}$/.test(customer.phone) &&
    typeof location?.reference === 'string' && location.reference.trim().length >= 3 && location.reference.length <= 500 &&
    typeof location.latitude === 'number' && location.latitude >= -90 && location.latitude <= 90 &&
    typeof location.longitude === 'number' && location.longitude >= -180 && location.longitude <= 180;
}

function jsonSchema() {
  return {
    name: 'mecanikall_whatsapp_response',
    strict: true,
    schema: {
      type: 'object', additionalProperties: false,
      required: ['reply', 'session', 'readyForDiagnosis', 'nextRequiredField', 'diagnostic'],
      properties: {
        reply: { type: 'string' },
        session: {
          type: 'object', additionalProperties: false, required: ['vehicle', 'symptom', 'drivable', 'collected'],
          properties: {
            vehicle: {
              type: 'object', additionalProperties: false, required: ['brand', 'model', 'year', 'engineOrTransmission', 'engineKnown'],
              properties: { brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] }, year: { type: ['number', 'null'] }, engineOrTransmission: { type: ['string', 'null'] }, engineKnown: { type: 'boolean' } },
            },
            symptom: { type: ['string', 'null'] }, drivable: { type: 'string', enum: ['yes', 'no', 'unknown'] },
            collected: {
              type: 'object', additionalProperties: false, required: ['vehicle', 'engineOrTransmission', 'symptom', 'drivable'],
              properties: { vehicle: { type: 'boolean' }, engineOrTransmission: { type: 'boolean' }, symptom: { type: 'boolean' }, drivable: { type: 'boolean' } },
            },
          },
        },
        readyForDiagnosis: { type: 'boolean' }, nextRequiredField: { type: ['string', 'null'], enum: ['vehicle', 'engineOrTransmission', 'symptom', 'drivable', null] },
        diagnostic: {
          type: 'object', additionalProperties: false, required: ['urgency', 'possibleCauses', 'estimatedCostMxn', 'nextStep'],
          properties: { urgency: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] }, possibleCauses: { type: 'array', items: { type: 'string' } }, estimatedCostMxn: { type: ['string', 'null'] }, nextStep: { type: ['string', 'null'] } },
        },
      },
    },
  };
}

function parseResponse(value: string): AiResponse {
  const normalized = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const result = JSON.parse(normalized) as AiResponse;
  if (!result.reply || typeof result.reply !== 'string' || !result.reply.includes(DISCLAIMER)) throw new Error('La respuesta de IA no cumple el contrato de seguridad.');
  return result;
}

/** Anthropic requires alternating roles; WhatsApp can deliver consecutive messages from one sender. */
function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((normalized, message) => {
    const previous = normalized.at(-1);
    if (previous?.role === message.role) previous.content = `${previous.content}\n${message.content}`;
    else normalized.push({ ...message });
    return normalized;
  }, []);
}

function ticketDescription(result: AiResponse): string {
  const vehicle = [result.session.vehicle.brand, result.session.vehicle.model, result.session.vehicle.year].filter(Boolean).join(' ');
  const motor = result.session.vehicle.engineOrTransmission ? ` Motor/transmisión: ${result.session.vehicle.engineOrTransmission}.` : '';
  return `Pre-diagnóstico Mecanikall AI. Vehículo: ${vehicle}. Síntoma: ${result.session.symptom ?? 'No especificado'}. ¿Rueda?: ${result.session.drivable}.${motor} Urgencia IA: ${result.diagnostic.urgency ?? 'sin clasificar'}. Causas sugeridas: ${result.diagnostic.possibleCauses.join('; ')}. Costo IA: ${result.diagnostic.estimatedCostMxn ?? 'sin estimación'}.`;
}

async function createTicket(sessionId: string, request: TicketRequest, result: AiResponse): Promise<CreatedTicket> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!serviceRoleKey || !url) throw new Error('Faltan credenciales de Supabase para crear el ticket.');
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc('registrar_ticket_desde_whatsapp', {
    p_sesion_ai: sessionId,
    p_nombre: request.customer.name.trim(),
    p_telefono: request.customer.phone.replace(/\D/g, ''),
    p_ubicacion: request.location.reference.trim(),
    p_latitud: request.location.latitude,
    p_longitud: request.location.longitude,
    p_descripcion: ticketDescription(result),
    p_prediagnostico: result.diagnostic,
    p_urgencia: result.diagnostic.urgency,
  }).single<CreatedTicket>();
  if (error || !data) throw error ?? new Error('No fue posible crear el ticket.');
  return data;
}

async function askOpenAi(prompt: string, messages: ChatMessage[]): Promise<AiResponse> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('Falta OPENAI_API_KEY.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('AI_MODEL') ?? 'gpt-4o', temperature: 0.2, response_format: { type: 'json_schema', json_schema: jsonSchema() }, messages: [{ role: 'system', content: prompt }, ...messages] }),
  });
  if (!response.ok) throw new Error(`OpenAI respondió ${response.status}.`);
  const body = await response.json();
  return parseResponse(body.choices?.[0]?.message?.content ?? '');
}

async function askAnthropic(prompt: string, messages: ChatMessage[]): Promise<AiResponse> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('AI_MODEL') ?? 'claude-3-5-sonnet-latest', max_tokens: 1_200, temperature: 0.2, system: prompt, messages }),
  });
  if (!response.ok) throw new Error(`Anthropic respondió ${response.status}.`);
  const body = await response.json();
  return parseResponse(body.content?.find((part: { type: string }) => part.type === 'text')?.text ?? '');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse('Método no permitido.', 405);
  if (!await authorized(request)) return errorResponse('No autorizado.', 401);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return errorResponse('Solicitud demasiado grande.', 413);

  let input: unknown;
  try { input = await request.json(); } catch { return errorResponse('JSON inválido.'); }
  if (!isAiRequest(input)) return errorResponse('sessionId o historial de mensajes inválido.');
  if (input.messages.at(-1)?.role !== 'user') return errorResponse('El último mensaje debe ser del usuario.');

  try {
    const prompt = systemPrompt();
    const provider = (Deno.env.get('AI_PROVIDER') ?? 'openai').toLowerCase();
    const messages = normalizeMessages(input.messages);
    const result = provider === 'anthropic' ? await askAnthropic(prompt, messages) : provider === 'openai' ? await askOpenAi(prompt, messages) : null;
    if (!result) return errorResponse('AI_PROVIDER debe ser openai o anthropic.', 500);
    const ticket = result.readyForDiagnosis && validTicketRequest(input.ticketRequest)
      ? await createTicket(input.sessionId, input.ticketRequest, result)
      : null;
    return Response.json({ sessionId: input.sessionId, ...result, ticket: ticket ? { id: ticket.id_ticket, created: true } : { id: null, created: false } }, { headers: jsonHeaders });
  } catch (error) {
    console.error('mecanikall-ai error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('No fue posible generar el pre-diagnóstico. Intenta de nuevo en unos minutos.', 502);
  }
});
