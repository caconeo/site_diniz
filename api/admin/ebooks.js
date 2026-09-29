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

// Carrega eventuais overrides locais salvos em arquivo
async function getLocalOverrides() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const overrideFile = path.resolve(process.cwd(), 'api/lib/catalog_overrides.json');
    if (fs.existsSync(overrideFile)) {
      const data = fs.readFileSync(overrideFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Silencioso em ambiente serverless somente leitura
  }
  return {};
}

// Salva eventuais overrides locais em arquivo
async function saveLocalOverride(id, data) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const overrideFile = path.resolve(process.cwd(), 'api/lib/catalog_overrides.json');
    let current = {};
    if (fs.existsSync(overrideFile)) {
      try {
        current = JSON.parse(fs.readFileSync(overrideFile, 'utf8'));
      } catch (err) {}
    }
    current[id] = { ...(current[id] || {}), ...data };
    fs.writeFileSync(overrideFile, JSON.stringify(current, null, 2), 'utf8');
  } catch (e) {
    // Silencioso em ambiente serverless somente leitura
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-supabase-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const clientKey = req.headers['x-supabase-key'];
    const localOverrides = await getLocalOverrides();

    // 1. GET: Retorna a lista de todos os e-books, seus valores e pastas mapeadas
    if (req.method === 'GET') {
      let remoteEbooks = null;
      try {
        remoteEbooks = await supabaseRequest('ebooks?select=*&order=created_at.asc', { customKey: clientKey });
      } catch (e) {
        console.warn('[Supabase Ebooks GET]: Usando catálogo local e cache:', e.message);
      }

      if (remoteEbooks && Array.isArray(remoteEbooks) && remoteEbooks.length > 0) {
        const enriched = remoteEbooks.map(eb => {
          const defaultData = EBOOK_CATALOG[eb.id] || {};
          const localOverride = localOverrides[eb.id] || {};
          let hotmartUrl = eb.hotmart_url;
          let cleanFeatures = eb.features;

          // Extrai hotmart_url embutido em features se a coluna dedicada ainda não existir no schema
          if (!hotmartUrl && Array.isArray(eb.features)) {
            const metaItem = eb.features.find(f => typeof f === 'string' && f.startsWith('__hotmart_url'));
            if (metaItem) {
              hotmartUrl = metaItem.replace(/^__hotmart_url_{0,2}:/, '');
            }
          }

          // Limpa array de features para não exibir a tag técnica na interface
          if (Array.isArray(cleanFeatures)) {
            cleanFeatures = cleanFeatures.filter(f => typeof f !== 'string' || !f.startsWith('__hotmart_url'));
          }

          const resolvedHotmartUrl = hotmartUrl || localOverride.hotmart_url || defaultData.hotmartUrl || `https://pay.hotmart.com/${eb.id}`;

          return {
            ...eb,
            features: cleanFeatures,
            hotmart_url: resolvedHotmartUrl,
          };
        });
        return res.status(200).json({ success: true, source: 'supabase', ebooks: enriched });
      }

      // Recupera modificações do catálogo se Supabase estiver offline
      const list = [];
      for (const [id, defaultData] of Object.entries(EBOOK_CATALOG)) {
        const folderInfo = DEFAULT_PLATFORM_FOLDERS[id] || { platform: 'site_direto', folder_path: 'ebook/conteudo/' };
        const localOverride = localOverrides[id] || {};

        list.push({
          id,
          title: localOverride.title || defaultData.title,
          short_title: localOverride.short_title || defaultData.shortTitle,
          kicker: defaultData.kicker,
          badge: defaultData.badge,
          price: localOverride.price !== undefined ? localOverride.price : defaultData.price,
          original_price: localOverride.original_price !== undefined ? localOverride.original_price : defaultData.originalPrice,
          platform: localOverride.platform || folderInfo.platform,
          folder_path: localOverride.folder_path || folderInfo.folder_path,
          hotmart_url: localOverride.hotmart_url || defaultData.hotmartUrl || `https://pay.hotmart.com/${id}`,
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

      const cleanHotmartUrl = typeof hotmart_url === 'string' ? hotmart_url.trim() : '';

      // Prepara payload compatível com as colunas do Supabase
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

      // 1. Tenta atualizar no Supabase com hotmart_url diretamente (se a coluna já existir)
      if (cleanHotmartUrl) {
        try {
          const patchWithUrl = await supabaseRequest(`ebooks?id=eq.${id}`, {
            method: 'PATCH',
            customKey: clientKey,
            body: JSON.stringify({ ...supabasePayload, hotmart_url: cleanHotmartUrl }),
          });
          if (patchWithUrl && Array.isArray(patchWithUrl) && patchWithUrl.length > 0) {
            supabaseOk = true;
          }
        } catch (errCol) {
          // Coluna hotmart_url não existe no schema Supabase ainda
        }
      }

      // 2. Se a gravação direta não ocorreu, persiste gravando hotmart_url na coluna JSONB features
      if (!supabaseOk) {
        try {
          // Busca features atuais do e-book no Supabase para preservar o array original
          let currentFeatures = [];
          try {
            const currentRows = await supabaseRequest(`ebooks?id=eq.${id}&select=features`, { customKey: clientKey });
            if (currentRows && currentRows[0] && Array.isArray(currentRows[0].features)) {
              currentFeatures = currentRows[0].features;
            }
          } catch (e) {
            currentFeatures = EBOOK_CATALOG[id]?.features ? [...EBOOK_CATALOG[id].features] : [];
          }

          // Remove tags anteriores e anexa nova tag
          const cleanFeatures = currentFeatures.filter(f => typeof f !== 'string' || !f.startsWith('__hotmart_url'));
          if (cleanHotmartUrl) {
            cleanFeatures.push(`__hotmart_url__:${cleanHotmartUrl}`);
          }

          const patchWithFeatures = await supabaseRequest(`ebooks?id=eq.${id}`, {
            method: 'PATCH',
            customKey: clientKey,
            body: JSON.stringify({ ...supabasePayload, features: cleanFeatures }),
          });

          if (patchWithFeatures && Array.isArray(patchWithFeatures) && patchWithFeatures.length > 0) {
            supabaseOk = true;
          }
        } catch (errFeatures) {
          // Fallback final: tenta patch apenas com as colunas base
          try {
            const patchBase = await supabaseRequest(`ebooks?id=eq.${id}`, {
              method: 'PATCH',
              customKey: clientKey,
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
      }

      // Salva override localmente em arquivo para persistência no ambiente de desenvolvimento
      await saveLocalOverride(id, {
        ...supabasePayload,
        hotmart_url: cleanHotmartUrl,
      });

      // Atualiza também cache do Redis para sincronia instantânea
      const existingCustom = (await getJson(`custom_ebook:${id}`)) || {};
      const merged = { ...existingCustom, ...supabasePayload, hotmart_url: cleanHotmartUrl, id };
      await setJson(`custom_ebook:${id}`, merged);

      if (!supabaseOk && !process.env.SUPABASE_URL) {
        return res.status(200).json({
          success: true,
          message: '✓ Alterações salvas localmente (Supabase não conectado).',
          ebook: merged,
          savedInSupabase: false,
        });
      }

      if (!supabaseOk && supabaseError) {
        return res.status(500).json({
          success: false,
          error: `Falha ao gravar no Supabase: ${supabaseError}`,
          savedInSupabase: false,
        });
      }

      return res.status(200).json({
        success: true,
        message: '✓ E-book e links gravados com sucesso no Banco de Dados Supabase!',
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
