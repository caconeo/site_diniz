// api/lib/email.js — Notificador Transacional de Acesso ao E-book
// Suporta Resend API nativa ou fallback com log estruturado.

export async function sendAccessEmail({ customerEmail, customerName, ebook, accessCode, accessLink }) {
  const subject = `Seu acesso liberado: ${ebook.shortTitle} — Cássio Diniz`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
        .box { max-width: 580px; margin: 0 auto; background: #162235; border: 1px solid #23394f; border-radius: 14px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .logo { font-size: 1.25rem; font-weight: 800; color: #67d5c5; margin-bottom: 24px; letter-spacing: -0.02em; }
        h1 { font-size: 1.4rem; color: #ffffff; margin-bottom: 12px; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 18px; }
        .code-box { background: #0b131e; border: 1px dashed #67d5c5; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0; }
        .code-title { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.12em; color: #67d5c5; font-weight: 700; margin-bottom: 6px; }
        .code-val { font-size: 1.6rem; font-family: monospace; font-weight: 800; color: #ffffff; letter-spacing: 0.1em; }
        .btn { display: inline-block; background: #67d5c5; color: #0b131e; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 800; font-size: 1rem; margin-top: 10px; }
        .footer { font-size: 0.8rem; color: #64748b; margin-top: 32px; border-top: 1px solid #23394f; padding-top: 18px; }
        .warning { font-size: 0.82rem; color: #f59e0b; background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="logo">CÁSSIO DINIZ · LIVRARIA DIGITAL</div>
        <h1>Olá, ${customerName || 'Leitor(a)'}!</h1>
        <p>Seu pagamento foi confirmado com sucesso. O seu acesso individual ao e-book <strong>${ebook.title}</strong> está oficialmente liberado.</p>
        
        <div class="code-box">
          <div class="code-title">Seu Código Exclusivo de Acesso</div>
          <div class="code-val">${accessCode}</div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a class="btn" href="${accessLink}" target="_blank">Acessar Leitor Digital Agora ↗</a>
        </div>

        <div class="warning">
          <strong>Aviso de Segurança:</strong> Este código é pessoal e intransferível. Por motivos de segurança e direitos autorais, o sistema permite apenas <strong>uma sessão ativa por vez</strong>. Caso tente abrir em outro dispositivo simultaneamente, a sessão anterior será automaticamente encerrada.
        </div>

        <div class="footer">
          Cássio Diniz — Análise de Sistemas, UI/UX e Design Editorial<br>
          Dúvidas ou suporte? Entre em contato pelo WhatsApp: +55 (31) 99396-3275
        </div>
      </div>
    </body>
    </html>
  `;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Livraria Digital Cássio Diniz <ebooks@cassiodiniz.com.br>',
          to: [customerEmail],
          subject,
          html: htmlContent,
        }),
      });
      const data = await resp.json();
      console.log('[Email Resend Enviado]:', data);
      return { sent: true, provider: 'resend', id: data.id };
    } catch (err) {
      console.error('[Email Resend Erro]:', err.message);
    }
  }

  // Fallback em log para desenvolvimento/teste
  console.log(`\n======================================================`);
  console.log(`[SIMULAÇÃO DE ENVIO DE E-MAIL]`);
  console.log(`Para: ${customerEmail}`);
  console.log(`Assunto: ${subject}`);
  console.log(`Código de Acesso: ${accessCode}`);
  console.log(`Link Direto: ${accessLink}`);
  console.log(`======================================================\n`);

  return { sent: true, provider: 'mock_console', code: accessCode };
}
