// api/lib/redis.js — Conector Ultra-Rápido Upstash Redis REST para Vercel Serverless
// Permite zero dependências npm externas e execução instantânea sem cold-start.

const localMemoryStore = new Map();

export async function redisCommand(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const endpoint = url.replace(/\/$/, '');
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([command, ...args]),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data.result;
    } catch (err) {
      console.error('[Redis Upstash Error]:', err.message);
      // Fallback em caso de instabilidade de rede
    }
  }

  // Fallback em memória (para testes locais sem .env configurado)
  const cmd = command.toUpperCase();
  const key = args[0];

  if (cmd === 'GET') {
    const item = localMemoryStore.get(key);
    if (!item) return null;
    if (item.expires && item.expires < Date.now()) {
      localMemoryStore.delete(key);
      return null;
    }
    return item.val;
  }

  if (cmd === 'SET') {
    const val = args[1];
    localMemoryStore.set(key, { val, expires: null });
    return 'OK';
  }

  if (cmd === 'SETEX') {
    const seconds = parseInt(args[1], 10);
    const val = args[2];
    localMemoryStore.set(key, { val, expires: Date.now() + seconds * 1000 });
    return 'OK';
  }

  if (cmd === 'DEL') {
    localMemoryStore.delete(key);
    return 1;
  }

  return null;
}

export async function getJson(key) {
  const data = await redisCommand('GET', key);
  if (!data) return null;
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    return data;
  }
}

export async function setJson(key, value, expireSeconds = null) {
  const str = JSON.stringify(value);
  if (expireSeconds) {
    return await redisCommand('SETEX', key, expireSeconds, str);
  }
  return await redisCommand('SET', key, str);
}

export async function deleteKey(key) {
  return await redisCommand('DEL', key);
}
