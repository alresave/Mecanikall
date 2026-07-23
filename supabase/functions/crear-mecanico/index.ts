import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const publicKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  const caller = createClient(url, publicKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await caller.auth.getUser();
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const admin = createClient(url, keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const [adminRole, salesRole] = await Promise.all([
    admin.from('administradores').select('id_usuario').eq('id_usuario', user?.id ?? '').maybeSingle(),
    admin.from('vendedores').select('id_usuario').eq('id_usuario', user?.id ?? '').maybeSingle(),
  ]);
  if (!user || (!adminRole.data && !salesRole.data)) return new Response('No autorizado', { status: 403 });
  const input = await request.json();
  if (!input.email || !input.nombre_taller || !input.whatsapp_destino || !input.zona_cobertura) return new Response('Datos incompletos', { status: 400 });
  const redirectTo = Deno.env.get('APP_URL') ? `${Deno.env.get('APP_URL')!.replace(/\/$/, '')}/acceso` : undefined;
  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(input.email.trim(), redirectTo ? { redirectTo } : undefined);
  if (createError || !created.user) return Response.json({ error: createError?.message ?? 'No fue posible enviar la invitación' }, { status: 400 });
  const { error: profileError } = await admin.from('mecanicos').insert({ id_usuario: created.user.id, nombre_taller: input.nombre_taller.trim(), whatsapp_destino: input.whatsapp_destino.replace(/\D/g, ''), zona_cobertura: input.zona_cobertura.trim(), especialidades: input.especialidades ?? [], palabras_clave: [], estatus_suscripcion: 'Pendiente' });
  if (profileError) { await admin.auth.admin.deleteUser(created.user.id); return Response.json({ error: profileError.message }, { status: 400 }); }
  return Response.json({ id_mecanico: created.user.id }, { status: 201 });
});
