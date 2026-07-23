import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const admin = createClient(url, keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const publicKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  const caller = createClient(url, publicKey, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await caller.auth.getUser();
  const { data: role } = await admin.from('administradores').select('id_usuario').eq('id_usuario', user?.id ?? '').maybeSingle();
  if (!user || !role) return new Response('No autorizado', { status: 403 });
  const input = await request.json();
  if (!input.email || !input.password) return new Response('Datos incompletos', { status: 400 });
  const { data, error } = await admin.auth.admin.createUser({ email: input.email.trim(), password: input.password, email_confirm: true });
  if (error || !data.user) return Response.json({ error: error?.message ?? 'No fue posible crear el usuario' }, { status: 400 });
  const { error: insertError } = await admin.from('vendedores').insert({ id_usuario: data.user.id });
  if (insertError) { await admin.auth.admin.deleteUser(data.user.id); return Response.json({ error: insertError.message }, { status: 400 }); }
  return Response.json({ ok: true }, { status: 201 });
});
