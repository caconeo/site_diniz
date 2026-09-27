// api/session.js — Heartbeat e Bloqueio de Concorrência em Tempo Real
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
    const { accessCode, sessionToken } = req.body || {};

    if (!accessCode || !sessionToken) {
      return res.status(400).json({ error: 'Parâmetros de sessão incompletos.' });
    }

    const cleanCode = accessCode.trim().toUpperCase();
    const sessionData = await getJson(`session:${cleanCode}`);

    // Se a sessão expirou ou não existe
    if (!sessionData) {
      return res.status(403).json({
        active: false,
        code: 'SESSION_NOT_FOUND',
        message: 'A sessão ativa não foi encontrada ou foi expirada por inatividade. Faça login novamente.'
      });
    }

    // REGRA CRÍTICA DE BLOQUEIO CONCORRENTE:
    // Se o token da requisição for diferente do token gravado no Redis,
    // significa que alguém fez login em outro aparelho ou navegador depois deste.
    if (sessionData.sessionToken !== sessionToken) {
      return res.status(403).json({
        active: false,
        code: 'CONCURRENT_LOGIN_DETECTED',
        message: 'Acesso bloqueado: Este e-book acabou de ser aberto em outro dispositivo ou navegador. Não é permitido o uso simultâneo de duas telas com a mesma licença.'
      });
    }

    // Atualiza o heartbeat
    sessionData.lastHeartbeat = Date.now();
    await setJson(`session:${cleanCode}`, sessionData, 86400 * 7);

    return res.status(200).json({
      active: true,
      lastHeartbeat: sessionData.lastHeartbeat,
      message: 'Sessão íntegra e exclusiva.'
    });
  } catch (err) {
    console.error('[Session Error]:', err);
    return res.status(500).json({ error: 'Erro ao validar sessão.' });
  }
}
