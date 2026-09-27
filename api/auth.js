// api/auth.js — Autenticação de Código de Acesso e Inicialização de Sessão Única
import { EBOOK_CATALOG } from './lib/catalog.js';
import { getJson, setJson } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { email, accessCode } = req.body || {};

    if (!accessCode) {
      return res.status(400).json({ error: 'Informe o código de acesso do e-book.' });
    }

    const cleanCode = accessCode.trim().toUpperCase();
    const tokenData = await getJson(`token:${cleanCode}`);

    // Se o código não existe no banco
    if (!tokenData) {
      return res.status(401).json({
        authenticated: false,
        error: 'Código de acesso não encontrado. Verifique os caracteres e tente novamente.'
      });
    }

    // Se informou e-mail, valida compatibilidade
    if (email && tokenData.email) {
      const inputEmail = email.trim().toLowerCase();
      const storedEmail = tokenData.email.trim().toLowerCase();
      if (inputEmail !== storedEmail) {
        return res.status(401).json({
          authenticated: false,
          error: 'O e-mail informado não corresponde ao titular deste código de acesso.'
        });
      }
    }

    const ebook = EBOOK_CATALOG[tokenData.ebookId] || { title: 'E-book Digital', shortTitle: 'E-book Digital' };

    // Geração de Session Token Único.
    // Qualquer sessão anterior para esta chave será sobreposta e perderá a autorização.
    const sessionToken = `sess_${Math.random().toString(36).substring(2)}${Date.now()}`;

    await setJson(`session:${cleanCode}`, {
      sessionToken,
      accessCode: cleanCode,
      email: tokenData.email,
      ebookId: tokenData.ebookId,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
    }, 86400 * 7); // Sessão válida por 7 dias se mantida ativa

    return res.status(200).json({
      authenticated: true,
      sessionToken,
      accessCode: cleanCode,
      email: tokenData.email,
      name: tokenData.name || '',
      ebookId: tokenData.ebookId,
      ebookTitle: ebook.shortTitle,
      contentFile: ebook.contentFile,
      message: 'Acesso validado com sucesso. Sessão iniciada com exclusividade.'
    });
  } catch (err) {
    console.error('[Auth Error]:', err);
    return res.status(500).json({ error: 'Erro ao validar autenticação.' });
  }
}
