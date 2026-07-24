import { createClient } from 'npm:@supabase/supabase-js@2';

/** Invita una tienda de refacciones. Un administrador o taller activo puede emitir la invitación. */
Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const publicKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  const caller = createClient(url, publicKey, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response('No autorizado', { status: 403 });

  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const admin = createClient(url, keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const [adminRole, mechanic] = await Promise.all([
    admin.from('administradores').select('id_usuario').eq('id_usuario', user.id).maybeSingle(),
    admin.from('mecanicos').select('id_mecanico').eq('id_usuario', user.id).eq('estatus_suscripcion', 'Activo').maybeSingle(),
  ]);
  if (!adminRole.data && !mechanic.data) return new Response('No autorizado', { status: 403 });

  const input = await request.json();
  if (!input.email || !input.nombre_tienda || !input.whatsapp_destino || !input.zona_cobertura) return new Response('Datos incompletos', { status: 400 });
  const radio = Number(input.radio_cobertura_metros ?? 5000);
  if (![3000, 5000, 10000, 20000].includes(radio)) return new Response('Radio de cobertura inválido', { status: 400 });

  const redirectTo = Deno.env.get('APP_URL') ? `${Deno.env.get('APP_URL')!.replace(/\/$/, '')}/acceso` : undefined;
  const { data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email.trim(), redirectTo ? { redirectTo } : undefined);
  if (inviteError || !created.user) return Response.json({ error: inviteError?.message ?? 'No fue posible enviar la invitación' }, { status: 400 });

  const { error: profileError } = await admin.from('tiendas_refacciones').insert({
    id_usuario: created.user.id,
    id_mecanico_invitador: mechanic.data?.id_mecanico ?? null,
    nombre_tienda: input.nombre_tienda.trim(),
    whatsapp_destino: input.whatsapp_destino.replace(/\D/g, ''),
    zona_cobertura: input.zona_cobertura.trim(),
    radio_cobertura_metros: radio,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return Response.json({ error: profileError.message }, { status: 400 });
  }
  return Response.json({ ok: true }, { status: 201 });
});
