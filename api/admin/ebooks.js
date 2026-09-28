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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

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
        console.warn('[Supabase Ebooks GET]: Usando catálogo local e cache:', e.message);
      }

      if (remoteEbooks && Array.isArray(remoteEbooks) && remoteEbooks.length > 0) {
        // Enriquece os dados do Supabase com hotmart_url padrão caso a coluna ainda não exista
        const enriched = remoteEbooks.map(eb => {
          const defaultData = EBOOK_CATALOG[eb.id] || {};
          return {
            ...eb,
            hotmart_url: eb.hotmart_url || defaultData.hotmartUrl || `https://pay.hotmart.com/${eb.id}`,
          };
        });
        return res.status(200).json({ success: true, source: 'supabase', ebooks: enriched });
      }

      // Recupera modificações do catálogo se Supabase estiver offline
      const list = [];
      for (const [id, defaultData] of Object.entries(EBOOK_CATALOG)) {
        const folderInfo = DEFAULT_PLATFORM_FOLDERS[id] || { platform: 'site_direto', folder_path: 'ebook/conteudo/' };

        list.push({
          id,
          title: defaultData.title,
          short_title: defaultData.shortTitle,
          kicker: defaultData.kicker,
          badge: defaultData.badge,
          price: defaultData.price,
          original_price: defaultData.originalPrice,
          platform: folderInfo.platform,
          folder_path: folderInfo.folder_path,
          hotmart_url: defaultData.hotmartUrl || `https://pay.hotmart.com/${id}`,
          content_file: defaultData.contentFile,
          cover: defaultData.cover,
          lead: defaultData.lead,
          features: defaultData.features,
          status: 'active',
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

      // Prepara payload compatível estritamente com as colunas existentes no Supabase
      const supabasePayload = {
        updated_at: new Date().toISOString(),
      };

      if (price !== undefined && price !== '') supabasePayload.price = parseFloat(price);
      if (original_price !== undefined && original_price !== '') supabasePayload.original_price = parseFloat(original_price);
      if (platform) supabasePayload.platform = platform;
      if (folder_path) supabasePayload.folder_path = folder_path;
      if (status) supabasePayload.status = status;
      if (title) {
        supabasePayload.title = title;
        supabasePayload.short_title = title;
      }

      let supabaseOk = false;
      let supabaseError = null;

      // 1. Tenta atualizar no Supabase com hotmart_url (caso a coluna já tenha sido adicionada)
      if (hotmart_url) {
        try {
          const patchWithUrl = await supabaseRequest(`ebooks?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...supabasePayload, hotmart_url }),
          });
          if (patchWithUrl && Array.isArray(patchWithUrl) && patchWithUrl.length > 0) {
            supabaseOk = true;
          }
        } catch (errCol) {
          console.warn('[Supabase hotmart_url column check]: Coluna não presente ou falha, tentando payload base.');
        }
      }

      // 2. Se a primeira tentativa não gravou, atualiza com as colunas base garantidas
      if (!supabaseOk) {
        try {
          const patchBase = await supabaseRequest(`ebooks?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(supabasePayload),
          });
          if (patchBase && Array.isArray(patchBase) && patchBase.length > 0) {
            supabaseOk = true;
          }
        } catch (errBase) {
          supabaseError = errBase.message;
          console.error('[Supabase Update Error]:', errBase.message);
        }
      }

      if (!supabaseOk) {
        return res.status(500).json({
          success: false,
          error: `Falha ao gravar no Supabase: ${supabaseError || 'Nenhum registro atualizado'}`,
          savedInSupabase: false,
        });
      }

      // Atualiza também cache do Redis para sincronia instantânea
      const existingCustom = (await getJson(`custom_ebook:${id}`)) || {};
      const merged = { ...existingCustom, ...supabasePayload, hotmart_url, id };
      await setJson(`custom_ebook:${id}`, merged);

      return res.status(200).json({
        success: true,
        message: '✓ E-book gravado com sucesso no Banco de Dados Supabase!',
        ebook: merged,
        savedInSupabase: true,
      });
    }

    return res.status(405).json({ error: 'Método não suportado.' });
  } catch (error) {
    console.error('[Admin Ebooks Error]:', error);
    return res.status(500).json({ error: 'Erro ao processar e-books administrativos: ' + error.message });
  }
}
