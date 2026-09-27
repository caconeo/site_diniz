// api/admin/ebooks.js — Gestão de E-books, Valores e Mapeamento de Pastas por Plataforma
import { EBOOK_CATALOG } from '../lib/catalog.js';
import { getJson, setJson } from '../lib/redis.js';
import { supabaseRequest } from '../lib/supabase.js';

// Mapeamento padrão de pastas físicas por plataforma
const DEFAULT_PLATFORM_FOLDERS = {
  'esteira-automacao': {
    platform: 'hotmart',
    folder_path: 'ebook/hotmart/esteira-automacao/',
  },
  'trafego-hiperlocal': {
    platform: 'kiwify',
    folder_path: 'ebook/kiwify/trafego-hiperlocal/',
  },
  'copywriting-black': {
    platform: 'monetizze',
    folder_path: 'ebook/monetizee/copywriting-black/',
  },
  'python-automacao': {
    platform: 'hotmart',
    folder_path: 'ebook/hotmart/python-automacao/',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const clientKey = req.headers['x-supabase-key'];

    // 1. GET: Retorna a lista de todos os e-books, seus valores e pastas mapeadas
    if (req.method === 'GET') {
      let remoteEbooks = null;
      try {
        remoteEbooks = await supabaseRequest('ebooks?select=*&order=created_at.asc', { customKey: clientKey });
      } catch (e) {
        console.log('[Supabase Ebooks GET]: Usando fallback de catálogo e cache');
      }

      if (remoteEbooks && Array.isArray(remoteEbooks) && remoteEbooks.length > 0) {
        return res.status(200).json({ success: true, source: 'supabase', ebooks: remoteEbooks });
      }

      // Recupera modificações do Redis se houver
      const list = [];
      for (const [id, defaultData] of Object.entries(EBOOK_CATALOG)) {
        const customData = await getJson(`custom_ebook:${id}`);
        const folderInfo = DEFAULT_PLATFORM_FOLDERS[id] || { platform: 'site_direto', folder_path: 'ebook/conteudo/' };

        list.push({
          id,
          title: customData?.title || defaultData.title,
          short_title: customData?.short_title || defaultData.shortTitle,
          kicker: customData?.kicker || defaultData.kicker,
          badge: customData?.badge || defaultData.badge,
          price: customData?.price !== undefined ? customData.price : defaultData.price,
          original_price: customData?.original_price !== undefined ? customData.original_price : defaultData.originalPrice,
          platform: customData?.platform || folderInfo.platform,
          folder_path: customData?.folder_path || folderInfo.folder_path,
          hotmart_url: customData?.hotmart_url || defaultData.hotmartUrl || `https://pay.hotmart.com/${id}`,
          content_file: defaultData.contentFile,
          cover: defaultData.cover,
          lead: defaultData.lead,
          features: defaultData.features,
          status: customData?.status || 'active',
        });
      }

      return res.status(200).json({ success: true, source: 'local_catalog', ebooks: list });
    }

    // 2. POST / PUT: Atualiza valores, plataforma e caminho da pasta do e-book
    if (req.method === 'POST' || req.method === 'PUT') {
      const { id, price, original_price, platform, folder_path, status, title, hotmart_url } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'ID do e-book é obrigatório.' });
      }

      const updatePayload = {
        updated_at: new Date().toISOString(),
      };

      if (price !== undefined) updatePayload.price = parseFloat(price);
      if (original_price !== undefined) updatePayload.original_price = parseFloat(original_price);
      if (platform) updatePayload.platform = platform;
      if (folder_path) updatePayload.folder_path = folder_path;
      if (status) updatePayload.status = status;
      if (title) updatePayload.title = title;
      if (hotmart_url !== undefined) updatePayload.hotmart_url = hotmart_url;

      // Tenta persistir no Supabase se configurado
      let supabaseOk = false;
      try {
        const patchResult = await supabaseRequest(`ebooks?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        });
        if (patchResult) supabaseOk = true;
      } catch (err) {
        console.warn('[Supabase Ebooks Update Error]:', err.message);
      }

      // Salva no cache do Redis para atualização imediata na loja e checkout
      const existingCustom = (await getJson(`custom_ebook:${id}`)) || {};
      const merged = { ...existingCustom, ...updatePayload, id };
      await setJson(`custom_ebook:${id}`, merged);

      return res.status(200).json({
        success: true,
        message: 'E-book atualizado com sucesso!',
        ebook: merged,
        savedInSupabase: supabaseOk,
      });
    }

    return res.status(405).json({ error: 'Método não suportado.' });
  } catch (error) {
    console.error('[Admin Ebooks Error]:', error);
    return res.status(500).json({ error: 'Erro ao processar e-books administrativos.' });
  }
}
