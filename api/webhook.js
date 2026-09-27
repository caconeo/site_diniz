// api/webhook.js — Receptor Unificado de Webhooks (Mercado Pago, Asaas e Hotmart)
import { EBOOK_CATALOG } from './lib/catalog.js';
import { sendAccessEmail } from './lib/email.js';
import { getJson, setJson } from './lib/redis.js';

function generateUniqueCode(ebookId) {
  const prefix = (ebookId.split('-')[0] || 'EBOOK').toUpperCase().slice(0, 4);
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CD-${prefix}-${part1}-${part2}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Webhooks devem ser POST.' });
  }

  try {
    const body = req.body || {};
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'cassiodiniz.com.br';
    const proto = req.headers['x-forwarded-proto'] || 'https';

    // 1. Tratamento de Webhook Hotmart Oficial (se configurado)
    if (body.event === 'PURCHASE_APPROVED' || body.hottok) {
      const data = body.data || body;
      const buyerEmail = (data.buyer?.email || data.email || '').trim().toLowerCase();
      const buyerName = data.buyer?.name || data.name || 'Leitor(a)';
      const hotmartProdName = (data.product?.name || '').toLowerCase();

      // Mapeamento automático de nome do produto Hotmart para o ID de catálogo
      let ebookId = 'esteira-automacao';
      if (hotmartProdName.includes('tráfego') || hotmartProdName.includes('trafego')) ebookId = 'trafego-hiperlocal';
      else if (hotmartProdName.includes('copywriting') || hotmartProdName.includes('black')) ebookId = 'copywriting-black';
      else if (hotmartProdName.includes('python')) ebookId = 'python-automacao';

      const accessCode = generateUniqueCode(ebookId);
      const ebook = EBOOK_CATALOG[ebookId];
      const accessLink = `${proto}://${host}/ebook/leitor.html?token=${accessCode}&email=${encodeURIComponent(buyerEmail)}`;

      await setJson(`token:${accessCode}`, {
        accessCode,
        email: buyerEmail,
        name: buyerName,
        ebookId,
        platform: 'hotmart',
        transaction: data.purchase?.transaction || data.transaction,
        createdAt: Date.now(),
      });

      await sendAccessEmail({
        customerEmail: buyerEmail,
        customerName: buyerName,
        ebook,
        accessCode,
        accessLink,
      });

      return res.status(200).json({ received: true, platform: 'hotmart', accessCode });
    }

    // 2. Tratamento de Webhook Mercado Pago
    if (body.type === 'payment' || body.action === 'payment.updated') {
      const paymentId = body.data?.id || body.id;
      const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

      if (paymentId && mpToken) {
        const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${mpToken}` }
        });
        const paymentData = await mpResp.json();

        if (paymentData.status === 'approved') {
          const orderId = paymentData.external_reference;
          let order = orderId ? await getJson(`order:${orderId}`) : null;

          if (order && order.status !== 'approved') {
            const accessCode = generateUniqueCode(order.ebookId);
            const ebook = EBOOK_CATALOG[order.ebookId];
            const accessLink = `${proto}://${host}/ebook/leitor.html?token=${accessCode}&email=${encodeURIComponent(order.email)}`;

            await setJson(`token:${accessCode}`, {
              accessCode,
              email: order.email,
              name: order.name,
              ebookId: order.ebookId,
              orderId,
              platform: 'mercadopago',
              paymentId,
              createdAt: Date.now(),
            });

            order.status = 'approved';
            order.accessCode = accessCode;
            order.approvedAt = Date.now();
            await setJson(`order:${orderId}`, order, 86400 * 30);

            await sendAccessEmail({
              customerEmail: order.email,
              customerName: order.name,
              ebook,
              accessCode,
              accessLink,
            });
          }
        }
      }
      return res.status(200).json({ received: true, platform: 'mercadopago' });
    }

    // 3. Tratamento de Webhook Asaas
    if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
      const payment = body.payment || {};
      const orderId = payment.externalReference;
      if (orderId) {
        const order = await getJson(`order:${orderId}`);
        if (order && order.status !== 'approved') {
          const accessCode = generateUniqueCode(order.ebookId);
          const ebook = EBOOK_CATALOG[order.ebookId];
          const accessLink = `${proto}://${host}/ebook/leitor.html?token=${accessCode}&email=${encodeURIComponent(order.email)}`;

          await setJson(`token:${accessCode}`, {
            accessCode,
            email: order.email,
            name: order.name,
            ebookId: order.ebookId,
            orderId,
            platform: 'asaas',
            paymentId: payment.id,
            createdAt: Date.now(),
          });

          order.status = 'approved';
          order.accessCode = accessCode;
          order.approvedAt = Date.now();
          await setJson(`order:${orderId}`, order, 86400 * 30);

          await sendAccessEmail({
            customerEmail: order.email,
            customerName: order.name,
            ebook,
            accessCode,
            accessLink,
          });
        }
      }
      return res.status(200).json({ received: true, platform: 'asaas' });
    }

    return res.status(200).json({ received: true, status: 'ignored_or_unrecognized' });
  } catch (err) {
    console.error('[Webhook Error]:', err);
    return res.status(500).json({ error: 'Erro interno ao processar webhook.' });
  }
}
