import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const publicKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, publicKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || user.email?.toLowerCase() !== Deno.env.get('ADMIN_BOOTSTRAP_EMAIL')?.toLowerCase()) return new Response('No autorizado', { status: 403 });
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const admin = createClient(url, keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.from('administradores').upsert({ id_usuario: user.id });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
});
