import Stripe from 'npm:stripe@18.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-06-30.basil' });

Deno.serve(async (request) => {
  try {
    const event = await stripe.webhooks.constructEventAsync(await request.text(), request.headers.get('stripe-signature') ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
    if (!['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid'].includes(event.type)) return new Response('ok');
    const obj = event.data.object as Stripe.Subscription | Stripe.Checkout.Session | Stripe.Invoice;
    let sub: Stripe.Subscription;
    if (event.type === 'checkout.session.completed') {
      const session = obj as Stripe.Checkout.Session;
      if (!session.subscription) return new Response('ok');
      sub = await stripe.subscriptions.retrieve(String(session.subscription));
    } else if (event.type === 'invoice.paid') {
      const invoice = obj as Stripe.Invoice;
      // Stripe cambió la ubicación de subscription entre versiones de API; soportamos ambas formas.
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription
        ?? (invoice as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
      if (!subscriptionId) return new Response('ok');
      sub = await stripe.subscriptions.retrieve(subscriptionId);
    } else sub = obj as Stripe.Subscription;
    const tipo = sub.metadata.tipo_entidad, id = Number(sub.metadata.id_entidad);
    if (!tipo || !id) return new Response('ok');
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await db.from('suscripciones_comerciales').upsert({ tipo_entidad: tipo, id_entidad: id, stripe_customer_id: String(sub.customer), stripe_subscription_id: sub.id, estado: sub.status, periodo_actual_fin: new Date(sub.current_period_end * 1000).toISOString() }, { onConflict: 'tipo_entidad,id_entidad' });
    if (event.type === 'invoice.paid') {
      const invoice = obj as Stripe.Invoice;
      const { error } = await db.rpc('registrar_primer_pago_vendedor', { p_tipo_entidad: tipo, p_id_entidad: id, p_stripe_invoice_id: invoice.id, p_importe_pago: invoice.amount_paid / 100 });
      if (error) throw error;
    }
    return new Response('ok');
  } catch { return new Response('Firma inválida', { status: 400 }); }
});
