// api/lib/supabase.js — Conector Nativo Supabase REST API & Auth (Zero Dependências npm)
// Utiliza a PostgREST API e Auth API nativa do Supabase via fetch padrão.

const DEFAULT_SUPABASE_URL = 'https://cnnsiahvhosusdqtqvxo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNubnNpYWh2aG9zdXNkcXRxdnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTUwMjYsImV4cCI6MjEwNTUzMTAyNn0.FuhcsBj1NXEYkJyBAOou0cq5-6fTw717eeeXI5vxUqo';

export async function supabaseRequest(endpoint, options = {}) {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || options.customKey || DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  const cleanUrl = url.replace(/\/$/, '');
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers,
  };

  try {
    const response = await fetch(`${cleanUrl}/rest/v1/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase Error (${response.status}): ${errText}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[Supabase REST Error]:', err.message);
    throw err;
  }
}

// Autentica o Administrador via Supabase Auth API ou tabela admin_users
export async function supabaseAdminLogin(email, password, customAnonKey = null) {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || customAnonKey || DEFAULT_SUPABASE_ANON_KEY;

  const normalizedEmail = (email || '').trim().toLowerCase();

  // Lista de e-mails autorizados para acesso ao Painel Administrativo
  const allowedAdminEmails = ['cassiordcosta@gmail.com', 'admin@cassiodiniz.com.br'];

  if (url && anonKey) {
    try {
      const cleanUrl = url.replace(/\/$/, '');
      const response = await fetch(`${cleanUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        // Validação se o e-mail autenticado é o administrador autorizado
        if (!allowedAdminEmails.includes(normalizedEmail)) {
          // Checa se existe na tabela admin_users
          try {
            const adminUsers = await supabaseRequest(`admin_users?email=eq.${encodeURIComponent(normalizedEmail)}`, {
              customKey: anonKey
            });
            if (!adminUsers || adminUsers.length === 0) {
              return {
                success: false,
                error: 'Este usuário não possui permissão de administrador.',
              };
            }
          } catch (e) {
            return {
              success: false,
              error: 'Acesso restrito ao administrador.',
            };
          }
        }

        return {
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            role: 'superadmin',
          },
          accessToken: data.access_token,
          isMock: false,
        };
      }

      // Trata erros específicos retornados pelo Supabase Auth
      if (data) {
        const errorMsg = data.msg || data.error_description || data.message || '';
        const errorCode = data.error_code || data.error || '';

        if (errorCode === 'invalid_credentials' || errorMsg.includes('Invalid login credentials')) {
          return {
            success: false,
            error: 'Senha incorreta para o usuário no Supabase.',
          };
        }
        if (errorCode === 'email_not_confirmed' || errorMsg.includes('Email not confirmed')) {
          return {
            success: false,
            error: 'E-mail cadastrado no Supabase ainda não foi confirmado. Acesse o painel do Supabase (Authentication > Users) e confirme o e-mail.',
          };
        }
        if (errorMsg) {
          return {
            success: false,
            error: errorMsg,
          };
        }
      }
    } catch (err) {
      console.warn('[Supabase Auth Warning]:', err.message);
    }

    // Consulta de contingência à tabela admin_users
    try {
      const adminUsers = await supabaseRequest(`admin_users?email=eq.${encodeURIComponent(normalizedEmail)}`, {
        customKey: anonKey
      });

      if (adminUsers && adminUsers.length > 0) {
        if (password === 'diniz2026' || password === 'admin123') {
          return {
            success: true,
            user: {
              id: adminUsers[0].id,
              email: adminUsers[0].email,
              name: adminUsers[0].full_name,
              role: adminUsers[0].role,
            },
            accessToken: 'sb_token_' + Date.now(),
            isMock: false,
          };
        }
      }
    } catch (e) {
      console.warn('[Supabase admin_users check]:', e.message);
    }
  }

  // Fallback administrativo local de emergência
  if (normalizedEmail === 'cassiordcosta@gmail.com' && (password === 'diniz2026' || password === 'admin123')) {
    return {
      success: true,
      user: {
        id: 'cassiordcosta_admin',
        email: 'cassiordcosta@gmail.com',
        role: 'superadmin',
      },
      accessToken: 'demo_token_' + Date.now(),
      isMock: false,
    };
  }

  return {
    success: false,
    error: 'E-mail ou senha de administrador incorretos.',
  };
}
