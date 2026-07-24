import { createClient } from 'npm:@supabase/supabase-js@2';

interface WebhookPayload { record?: { id_notificacion?: number }; }
interface PushToken { token_fcm: string; titulo: string; mensaje: string; url_destino: string; }

const scope = 'https://www.googleapis.com/auth/firebase.messaging';

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

async function accessToken(serviceAccount: { client_email: string; private_key: string; token_uri?: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const audience = serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({ iss: serviceAccount.client_email, scope, aud: audience, iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(serviceAccount.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(audience, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!response.ok) throw new Error(`No fue posible autorizar FCM (${response.status})`);
  return (await response.json()).access_token;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST' || request.headers.get('x-webhook-secret') !== Deno.env.get('NOTIFICATION_WEBHOOK_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }

  const payload = await request.json() as WebhookPayload;
  const idNotificacion = payload.record?.id_notificacion;
  if (!idNotificacion) return new Response('Payload inválido', { status: 400 });

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const serviceKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await supabase.from('notificaciones_push').update({ estatus: 'Enviando', intentos: 1 }).eq('id_notificacion', idNotificacion);

  try {
    const { data: tokens, error } = await supabase.rpc('tokens_push_para_notificacion', { p_id_notificacion: idNotificacion });
    if (error) throw error;
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') ?? '');
    const token = await accessToken(serviceAccount);
    const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
    const results = await Promise.all(((tokens ?? []) as PushToken[]).map(async ({ token_fcm, titulo, mensaje, url_destino }) => {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { token: token_fcm, notification: { title: titulo, body: mensaje }, data: { url: url_destino } } }) });
      return response.ok;
    }));
    await supabase.from('notificaciones_push').update({ estatus: 'Enviado', enviados: results.filter(Boolean).length, processed_at: new Date().toISOString(), ultimo_error: null }).eq('id_notificacion', idNotificacion);
    return Response.json({ enviados: results.filter(Boolean).length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    await supabase.from('notificaciones_push').update({ estatus: 'Error', ultimo_error: message, processed_at: new Date().toISOString() }).eq('id_notificacion', idNotificacion);
    return Response.json({ error: message }, { status: 500 });
  }
});
