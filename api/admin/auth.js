// api/admin/auth.js — Autenticação Segura da Área do Administrador com Supabase
import { supabaseAdminLogin } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { email, password, anonKey } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const authResult = await supabaseAdminLogin(email, password, anonKey);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        error: authResult.error || 'Credenciais de administrador inválidas.'
      });
    }

    return res.status(200).json(authResult);
  } catch (err) {
    console.error('[Admin Auth Error]:', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar administrador.' });
  }
}
