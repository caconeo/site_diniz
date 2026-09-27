// api/status.js — Verificação em Tempo Real do Pagamento Pix e Liberação Imediata
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const orderId = req.query.orderId || req.body?.orderId;
  const simulateApproval = req.body?.simulateApproval || req.query.simulate === 'true';

  if (!orderId) {
    return res.status(400).json({ error: 'orderId obrigatório.' });
  }

  try {
    let order = await getJson(`order:${orderId}`);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado ou expirado.' });
    }

    // Se já está aprovado, retorna os dados de acesso imediatamente
    if (order.status === 'approved') {
      return res.status(200).json({
        status: 'approved',
        orderId: order.orderId,
        ebookId: order.ebookId,
        email: order.email,
        accessCode: order.accessCode,
        redirectUrl: `/ebook/leitor.html?token=${order.accessCode}&email=${encodeURIComponent(order.email)}`,
      });
    }

    // Se veio solicitação de simulação de aprovação (modo teste / desenvolvimento)
    let shouldApprove = simulateApproval;

    // Se possui gateway Mercado Pago configurado e ainda está pendente, consulta a API
    if (!shouldApprove && order.gateway === 'mercadopago' && order.gatewayPaymentId) {
      const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (mpToken) {
        try {
          const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${order.gatewayPaymentId}`, {
            headers: { Authorization: `Bearer ${mpToken}` }
          });
          const mpData = await mpResp.json();
          if (mpData.status === 'approved') {
            shouldApprove = true;
          }
        } catch (e) {
          console.error('[Erro checagem MP]:', e.message);
        }
      }
    }

    if (shouldApprove) {
      const accessCode = generateUniqueCode(order.ebookId);
      const ebook = EBOOK_CATALOG[order.ebookId];
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'cassiodiniz.com.br';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const accessLink = `${proto}://${host}/ebook/leitor.html?token=${accessCode}&email=${encodeURIComponent(order.email)}`;

      // Salva o token único vinculado ao e-book e ao e-mail do comprador
      await setJson(`token:${accessCode}`, {
        accessCode,
        email: order.email,
        name: order.name,
        ebookId: order.ebookId,
        orderId: order.orderId,
        createdAt: Date.now(),
      });

      // Atualiza o status do pedido para approved
      order.status = 'approved';
      order.accessCode = accessCode;
      order.approvedAt = Date.now();
      await setJson(`order:${orderId}`, order, 86400 * 30); // 30 dias de histórico

      // Dispara o e-mail transacional
      await sendAccessEmail({
        customerEmail: order.email,
        customerName: order.name,
        ebook,
        accessCode,
        accessLink,
      });

      return res.status(200).json({
        status: 'approved',
        orderId: order.orderId,
        ebookId: order.ebookId,
        email: order.email,
        accessCode,
        redirectUrl: `/ebook/leitor.html?token=${accessCode}&email=${encodeURIComponent(order.email)}`,
        message: 'Pagamento confirmado com sucesso! O acesso foi liberado.',
      });
    }

    return res.status(200).json({
      status: 'pending',
      orderId: order.orderId,
      message: 'Aguardando confirmação do pagamento pelo banco emissor.',
    });
  } catch (error) {
    console.error('[Status Error]:', error);
    return res.status(500).json({ error: 'Erro ao verificar status do pagamento.' });
  }
}
