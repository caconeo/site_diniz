// api/checkout.js — Criação de Cobrança Pix Transparente (Mercado Pago / Asaas / Simulador)
import { EBOOK_CATALOG } from './lib/catalog.js';
import { setJson } from './lib/redis.js';

export default async function handler(req, res) {
  // Configuração CORS para requisições seguras
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { ebookId, name, email, cpf } = req.body || {};

    if (!ebookId || !EBOOK_CATALOG[ebookId]) {
      return res.status(400).json({ error: 'E-book inválido ou não encontrado no catálogo.' });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Informe um e-mail válido para envio do código de acesso.' });
    }

    const ebook = EBOOK_CATALOG[ebookId];
    const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanCpf = (cpf || '').replace(/\D/g, '') || '00000000000';

    // 1. Verificação de Integração Oficial com Mercado Pago
    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (mpToken) {
      try {
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': orderId,
          },
          body: JSON.stringify({
            transaction_amount: ebook.price,
            description: `E-book: ${ebook.shortTitle}`,
            payment_method_id: 'pix',
            payer: {
              email: email.trim().toLowerCase(),
              first_name: name || 'Cliente',
              identification: {
                type: 'CPF',
                number: cleanCpf,
              },
            },
            notification_url: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/webhook`,
            external_reference: orderId,
          }),
        });

        const mpData = await mpResponse.json();

        if (mpData.point_of_interaction?.transaction_data) {
          const transData = mpData.point_of_interaction.transaction_data;
          
          await setJson(`order:${orderId}`, {
            orderId,
            gatewayPaymentId: mpData.id,
            gateway: 'mercadopago',
            ebookId,
            email: email.trim().toLowerCase(),
            name: name || '',
            amount: ebook.price,
            status: 'pending',
            createdAt: Date.now(),
          }, 86400); // 24h

          return res.status(200).json({
            success: true,
            orderId,
            ebookTitle: ebook.shortTitle,
            price: ebook.price,
            qrCodeBase64: `data:image/png;base64,${transData.qr_code_base64}`,
            copyPasteCode: transData.qr_code,
            isMock: false,
          });
        }
      } catch (err) {
        console.error('[Mercado Pago API Error]:', err.message);
      }
    }

    // 2. Modo Simulação / Ambiente de Testes sem credenciais configuradas
    const mockCopyPaste = `00020126580014br.gov.bcb.pix0136${orderId}-cassiodiniz-ebook5204000053039865405${ebook.price.toFixed(2)}5802BR5925CASSIO DINIZ SISTEMAS6009BELO HORIZONTE62070503***6304E6A1`;
    const mockQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockCopyPaste)}`;

    await setJson(`order:${orderId}`, {
      orderId,
      gateway: 'simulation',
      ebookId,
      email: email.trim().toLowerCase(),
      name: name || 'Leitor de Teste',
      amount: ebook.price,
      status: 'pending',
      createdAt: Date.now(),
    }, 86400);

    return res.status(200).json({
      success: true,
      orderId,
      ebookTitle: ebook.shortTitle,
      price: ebook.price,
      qrCodeBase64: mockQrCodeUrl,
      copyPasteCode: mockCopyPaste,
      isMock: true,
      instructions: 'Ambiente de testes ativo. Clique no botão de simulação para confirmar o pagamento imediatamente.',
    });
  } catch (error) {
    console.error('[Checkout Error]:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar pagamento Pix.' });
  }
}
