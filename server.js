import express from 'express';
import session from 'cookie-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = (process.env.APP_URL || 'https://bot.oussamma.tn').replace(/\/$/, '');

// =============================================================================
// CONFIGURATION DU FOURNISSEUR SSO
// =============================================================================
const SSO_BASE_URL = (process.env.SSO_BASE_URL || 'https://sso-a.oussamma.tn').replace(/\/$/, '');
const SSO_CLIENT_ID = process.env.SSO_CLIENT_ID || 'client_bbe0d965db17d39880d411af';
const SSO_CLIENT_SECRET = process.env.SSO_CLIENT_SECRET || 'sec_eLi20e99kRC-hkfqC6LsxV-d4dbYzO2pyCB5g9sCIEA';
const SSO_REDIRECT_URI = process.env.SSO_REDIRECT_URI || `${APP_URL}/auth/callback`;
const SSO_SCOPES = process.env.SSO_SCOPES || 'openid profile email';

// Endpoints SSO
const SSO_AUTH_ENDPOINT = `${SSO_BASE_URL}/oauth/authorize`;
const SSO_TOKEN_ENDPOINT = `${SSO_BASE_URL}/oauth/token`;
const SSO_USERINFO_ENDPOINT = `${SSO_BASE_URL}/oauth/userinfo`;
const SSO_LOGOUT_ENDPOINT = `${SSO_BASE_URL}/oauth/logout`;
const SSO_AI_PROMPT_ENDPOINT = `${SSO_BASE_URL}/api/v1/integrations/ai/prompt`;

// Détection de proxy pour Coolify / Traefik
app.set('trust proxy', true);

// Redirection automatique stricte vers HTTPS + HSTS (supprime le badge "Non sécurisé")
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  const protoHeader = req.headers['x-forwarded-proto'];
  const isHttp = protoHeader === 'http' || (protoHeader && !protoHeader.includes('https')) || (!protoHeader && req.protocol === 'http');

  if (
    isHttp &&
    !req.path.startsWith('/health') &&
    !req.path.startsWith('/api/health')
  ) {
    const host = req.headers.host || 'bot.oussamma.tn';
    return res.redirect(301, `https://${host}${req.originalUrl || req.url}`);
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessions serveur avec cookies signés et sécurisés (HttpOnly)
// secure: false permet le fonctionnement fluide derrière le proxy inverse de Coolify
app.use(
  session({
    name: 'bot_oussamma_session',
    keys: [process.env.SESSION_SECRET || 'super-secret-bot-oussamma-key-2026-prod'],
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    secure: false,
    sameSite: 'lax',
    httpOnly: true,
  })
);

// =============================================================================
// HELPER PKCE & STATE CRYPTOGRAPHIQUE AUTO-VÉRIFIABLE (HMAC)
// =============================================================================
const SECRET_SIGN_KEY = process.env.SESSION_SECRET || 'bot-oussamma-super-secret-key-2026-prod';

function generateOidcStateAndPKCE() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SECRET_SIGN_KEY).update(`state:${nonce}`).digest('hex');
  const state = `${nonce}.${signature}`;

  // Dérivation déterministe et sécurisée du code_verifier (RFC 7636)
  const code_verifier = crypto.createHmac('sha256', SECRET_SIGN_KEY).update(`pkce:${nonce}`).digest('base64url').substring(0, 64);
  const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

  return { state, code_verifier, code_challenge };
}

function verifyOidcState(stateParam, sessionState) {
  if (!stateParam) return null;

  // 1. Vérification cryptographique HMAC (robuste même en cas de perte de session)
  if (typeof stateParam === 'string' && stateParam.includes('.')) {
    const [nonce, signature] = stateParam.split('.');
    if (nonce && signature) {
      const expectedSignature = crypto.createHmac('sha256', SECRET_SIGN_KEY).update(`state:${nonce}`).digest('hex');
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSignature, 'hex');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          const derivedVerifier = crypto.createHmac('sha256', SECRET_SIGN_KEY).update(`pkce:${nonce}`).digest('base64url').substring(0, 64);
          return { valid: true, derivedVerifier };
        }
      } catch (e) {}
    }
  }

  // 2. Vérification session locale (fallback)
  if (sessionState && stateParam === sessionState) {
    return { valid: true };
  }

  return null;
}

// =============================================================================
// HEALTHCHECK (Pour Coolify / Docker / Traefik sans bloquer)
// =============================================================================
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), sso: SSO_BASE_URL });
});

// =============================================================================
// ROUTES AUTHENTIFICATION SSO (PUBLIQUES)
// =============================================================================

// A. Route de connexion (/auth/login)
app.get('/auth/login', (req, res) => {
  const { state, code_verifier, code_challenge } = generateOidcStateAndPKCE();

  // Sauvegarde PKCE et state dans la session utilisateur (redondance)
  req.session.pkce_code_verifier = code_verifier;
  req.session.oauth_state = state;

  const authUrl = new URL(SSO_AUTH_ENDPOINT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', SSO_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', SSO_REDIRECT_URI);
  authUrl.searchParams.set('scope', SSO_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', code_challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

// B. Route de callback (/auth/callback)
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('Erreur retournée par le SSO:', error, error_description);
    return res.redirect(`/auth/login?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/auth/login?error=code_manquant');
  }

  // 1. Vérification du paramètre state (Session ou Signature HMAC)
  const stateCheck = verifyOidcState(state, req.session?.oauth_state);
  if (!stateCheck || !stateCheck.valid) {
    console.warn('Paramètre state non reconnu ou session expirée, relance de la connexion');
    return res.redirect('/auth/login');
  }

  const code_verifier = req.session?.pkce_code_verifier || stateCheck.derivedVerifier || '';

  try {
    // 2. Échange du code d'autorisation contre les tokens auprès du SSO
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: SSO_CLIENT_ID,
      client_secret: SSO_CLIENT_SECRET,
      code: code.toString(),
      redirect_uri: SSO_REDIRECT_URI,
      code_verifier: code_verifier,
    });

    const tokenRes = await fetch(SSO_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams,
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Erreur échange token SSO:', tokenRes.status, errBody);
      return res.redirect('/auth/login?error=echange_token_echoue');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const idToken = tokenData.id_token || null;

    if (!accessToken) {
      return res.status(502).send('Jeton access_token non fourni par le SSO.');
    }

    // 3. Récupération des informations de profil via /oauth/userinfo
    let profile = null;
    try {
      const userRes = await fetch(SSO_USERINFO_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (userRes.ok) {
        profile = await userRes.json();
      }
    } catch (e) {
      console.warn('Impossible de récupérer /oauth/userinfo:', e.message);
    }

    // 4. Stockage sécurisé des informations en session serveur
    const userRoles = profile?.roles || [];
    const isSuperAdmin = Boolean(
      profile?.is_superadmin ||
      userRoles.includes('super_admin') ||
      (profile?.email && profile.email.toLowerCase() === 'oussammabenhassine@gmail.com')
    );

    req.session.access_token = accessToken;
    req.session.refresh_token = refreshToken;
    req.session.user = {
      id: profile?.sub || profile?.id || 'sso-user',
      name: profile?.name || profile?.username || profile?.email || 'Utilisateur SSO',
      email: profile?.email || 'user@oussamma.tn',
      avatar: profile?.picture || profile?.avatar || null,
      roles: userRoles,
      is_superadmin: isSuperAdmin,
      ssoConnected: true,
    };

    // Nettoyage des clés temporaires de PKCE
    delete req.session.pkce_code_verifier;
    delete req.session.oauth_state;

    // Redirection vers l'application principale protégée
    res.redirect('/?reconnected=1');
  } catch (err) {
    console.error('Erreur callback SSO:', err);
    res.status(500).send('Erreur interne lors de la finalisation de la connexion SSO.');
  }
});

// C. Route de déconnexion (/auth/logout)
app.get('/auth/logout', (req, res) => {
  req.session = null;
  const postLogoutRedirect = encodeURIComponent(APP_URL);
  res.redirect(`${SSO_LOGOUT_ENDPOINT}?post_logout_redirect_uri=${postLogoutRedirect}`);
});

// =============================================================================
// REFRESH TOKEN AUTOMATIQUE AUPRÈS DU SSO
// =============================================================================
async function refreshAccessToken(req) {
  const refreshToken = req.session?.refresh_token;
  if (!refreshToken) return null;

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: SSO_CLIENT_ID,
      client_secret: SSO_CLIENT_SECRET,
      refresh_token: refreshToken,
    });

    const res = await fetch(SSO_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params,
    });

    if (res.ok) {
      const data = await res.json();
      req.session.access_token = data.access_token;
      if (data.refresh_token) {
        req.session.refresh_token = data.refresh_token;
      }
      return data.access_token;
    }
  } catch (err) {
    console.error('Erreur refresh token SSO:', err.message);
  }
  return null;
}

// =============================================================================
// MIDDLEWARE DE SÉCURITÉ ABSOLUE : VERROUILLAGE TOTAL
// =============================================================================
function requireAuth(req, res, next) {
  // Chemins exemptés de l'authentification (routes SSO, sondes de santé et assets statiques)
  const publicPaths = ['/auth/login', '/auth/callback', '/auth/logout', '/health', '/api/health', '/favicon.ico'];
  if (publicPaths.includes(req.path) || req.path.startsWith('/assets/')) {
    return next();
  }

  const isAuthenticated = Boolean(req.session?.access_token && req.session?.user);

  if (isAuthenticated) {
    return next();
  }

  // Si non authentifié :
  // A. Requêtes API JSON -> 401 Unauthorized
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      error: 'auth_required',
      message: 'Authentification SSO requise pour accéder à cette ressource.',
      login_url: '/auth/login',
    });
  }

  // B. Requêtes Pages / HTML / Statiques -> Redirection 302 immédiate vers le SSO
  return res.redirect('/auth/login');
}

// Application du middleware de verrouillage sur TOUTE l'application
app.use(requireAuth);

// Fichiers statiques protégés (Accessibles uniquement après authentification SSO)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Endpoint profil utilisateur
app.get('/api/auth/me', (req, res) => {
  res.json({
    authenticated: true,
    user: req.session.user,
    ssoUrl: SSO_BASE_URL,
  });
});

// Endpoint des modèles IA réellement configurés et autorisés
app.get('/api/models/available', async (req, res) => {
  const configuredModels = [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Passerelle ai.oussamma.tn (Ultra-rapide)',
      badge: 'ai.oussamma.tn',
      icon: 'zap',
      requiresKey: false,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Passerelle ai.oussamma.tn (OpenAI)',
      badge: 'ai.oussamma.tn',
      icon: 'sparkles',
      requiresKey: false,
    },
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Passerelle ai.oussamma.tn (Anthropic)',
      badge: 'ai.oussamma.tn',
      icon: 'bot',
      requiresKey: false,
    },
  ];

  res.json({
    models: configuredModels,
    isSuperAdmin: Boolean(req.session?.user?.is_superadmin),
  });
});

// =============================================================================
// ENDPOINTS MONITORING IA (RÉSERVÉS AU SUPERADMIN)
// =============================================================================
app.get('/api/admin/monitoring/stats', async (req, res) => {
  if (!req.session?.user?.is_superadmin) {
    return res.status(403).json({ error: 'Accès réservé au Superadmin' });
  }

  const userAccessToken = req.session?.access_token;
  try {
    const ssoRes = await fetch(`${SSO_BASE_URL}/api/v1/admin/audit-logs/ai/stats`, {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!ssoRes.ok) {
      return res.status(ssoRes.status).json({ error: 'Impossible de récupérer les statistiques IA' });
    }

    const data = await ssoRes.json();
    return res.json(data);
  } catch (err) {
    console.error('Erreur récupération stats monitoring:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/monitoring/logs', async (req, res) => {
  if (!req.session?.user?.is_superadmin) {
    return res.status(403).json({ error: 'Accès réservé au Superadmin' });
  }

  const userAccessToken = req.session?.access_token;
  const limit = req.query.limit || 50;
  const offset = req.query.offset || 0;

  try {
    const ssoRes = await fetch(`${SSO_BASE_URL}/api/v1/admin/audit-logs/ai?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!ssoRes.ok) {
      return res.status(ssoRes.status).json({ error: 'Impossible de récupérer le journal des appels IA' });
    }

    const data = await ssoRes.json();
    return res.json(data);
  } catch (err) {
    console.error('Erreur récupération logs monitoring:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint récupération clé Gemini du coffre-fort pour appel direct client (évite le blocage IP datacenter)
app.get('/api/gemini/credentials', async (req, res) => {
  const userAccessToken = req.session?.access_token;
  if (!userAccessToken) {
    return res.status(401).json({ error: 'Non authentifié auprès du SSO' });
  }

  try {
    const ssoRes = await fetch(`${SSO_BASE_URL}/api/v1/vault/providers/gemini/token`, {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!ssoRes.ok) {
      return res.status(ssoRes.status).json({ error: 'Aucune clé Gemini active dans votre coffre-fort' });
    }

    const data = await ssoRes.json();
    return res.json({ apiKey: data.token, model: 'gemini-2.0-flash' });
  } catch (err) {
    console.error('Erreur récupération clé Gemini:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération de la clé Gemini' });
  }
});

// =============================================================================
// RECHERCHE WEB EN TEMPS RÉEL (DUCKDUCKGO API)
// =============================================================================
async function performWebSearch(query) {
  if (!query || query.trim() === '') return [];

  try {
    const ddgApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgApiUrl, {
      headers: { 'User-Agent': 'BotOussama/1.0 (WebSearchClient)' },
    });

    const results = [];
    if (res.ok) {
      const data = await res.json();
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          snippet: data.AbstractText,
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          source: data.AbstractSource || 'DuckDuckGo Instant Answer',
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const item of data.RelatedTopics.slice(0, 4)) {
          if (item.Text && item.FirstURL) {
            results.push({
              title: item.Text.split(' - ')[0] || query,
              snippet: item.Text,
              url: item.FirstURL,
              source: 'Web',
            });
          }
        }
      }
    }

    if (results.length < 3) {
      try {
        const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          const regex = /<a class="result__snippet[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          let count = 0;
          while ((match = regex.exec(html)) !== null && count < 4) {
            const rawText = match[2].replace(/<[^>]+>/g, '').trim();
            if (rawText && rawText.length > 20) {
              results.push({
                title: `Source Web #${results.length + 1}`,
                snippet: rawText,
                url: match[1].startsWith('//') ? 'https:' + match[1] : match[1],
                source: 'Recherche Web en direct',
              });
              count++;
            }
          }
        }
      } catch (e) {}
    }

    return results;
  } catch (error) {
    console.error('Erreur recherche web:', error);
    return [];
  }
}

// =============================================================================
// ROUTE CHATBOT PROXY IA CODEX SSO (AVEC REFRESH TOKEN ET STREAMING)
// =============================================================================
app.post('/api/chat', async (req, res) => {
  const {
    messages = [],
    model = 'gpt-4o',
    enableWebSearch = false,
    systemPrompt = "Tu es un assistant IA conversationnel moderne, intelligent et serviable. Réponds avec pertinence, concision et structure tes réponses avec du beau Markdown.",
  } = req.body;

  // Configuration du streaming SSE (Server-Sent Events)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const lastUserMsg = messages[messages.length - 1]?.content || '';

  // 1. Recherche Web si activée
  let webContext = '';
  if (enableWebSearch && lastUserMsg) {
    sendSSE('status', { message: '🔍 Recherche sur le Web en direct...' });
    const searchResults = await performWebSearch(lastUserMsg);

    if (searchResults && searchResults.length > 0) {
      sendSSE('web_results', { results: searchResults });
      webContext = `\n\n[CONTEXTE DE RECHERCHE WEB EN DIRECT DU ${new Date().toLocaleDateString('fr-FR')}]:\n` +
        searchResults.map((r, i) => `[Source ${i + 1}] Titre: ${r.title}\nURL: ${r.url}\nExtrait: ${r.snippet}\n`).join('\n') +
        `\nInstructions: Utilise les résultats ci-dessus pour enrichir ta réponse et cite les sources au format [Source N](URL).`;
    }
  }

  // Construction du prompt structuré pour le proxy IA Codex
  const fullPrompt = [
    `INSTRUCTIONS SYSTÈME :\n${systemPrompt}${webContext}\n`,
    ...messages.map((m) => `${m.role === 'user' ? 'Utilisateur' : m.role === 'system' ? 'Système' : 'Assistant'} : ${m.content}`),
  ].join('\n\n');

  const targetModel = model || 'gemini-2.0-flash';

  sendSSE('status', {
    message: `⚡ Connexion à la passerelle IA ai.oussamma.tn (${targetModel})...`
  });

  let userAccessToken = req.session.access_token;

  // Appel direct à la passerelle IA via le SSO unifié
  const callSSOAI = async (token) => {
    return await fetch(SSO_AI_PROMPT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'ai.oussamma.tn',
        model: targetModel,
        prompt: fullPrompt,
      }),
    });
  };

  try {
    let aiResponse = await callSSOAI(userAccessToken);

    // Renouvellement automatique si le jeton SSO est expiré
    if (aiResponse.status === 401) {
      console.log('Jeton SSO expiré lors de l\'appel IA, tentative de refresh...');
      sendSSE('status', { message: '🔄 Renouvellement automatique du jeton SSO...' });

      const newToken = await refreshAccessToken(req);
      if (newToken) {
        userAccessToken = newToken;
        aiResponse = await callSSOAI(userAccessToken);
      }

      if (aiResponse.status === 401) {
        req.session = null;
        let ssoDetail = '';
        try {
          const errJson = await aiResponse.clone().json();
          ssoDetail = errJson.detail || JSON.stringify(errJson);
        } catch (e) {
          ssoDetail = await aiResponse.clone().text().catch(() => '');
        }

        const sessionExpiredMessage = 
          `### ⚠️ Session SSO expirée\n\n` +
          `Votre jeton de connexion a expiré.` +
          (ssoDetail ? `\n\n> *Message du SSO : ${ssoDetail}*` : '') +
          `\n\n<a href="https://bot.oussamma.tn/auth/login" style="display:inline-block;padding:10px 20px;margin:8px 0;background:#2563eb;color:#ffffff;border-radius:12px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,0.3);">🔑 Cliquez ici pour vous reconnecter au SSO (1 clic)</a>\n\n`;

        sendSSE('token', { token: sessionExpiredMessage });
        sendSSE('done', {});
        return res.end();
      }
    }

    if (!aiResponse.ok) {
      let detailMsg = '';
      try {
        const errJson = await aiResponse.json();
        detailMsg = errJson.detail || errJson.message || '';
      } catch (e) {
        detailMsg = await aiResponse.text();
      }

      console.warn('Erreur passerelle IA SSO:', aiResponse.status, detailMsg);
      const errorMsg =
        `### ⚠️ Erreur Passerelle IA (${aiResponse.status})\n\n` +
        `La requête vers la passerelle **ai.oussamma.tn** a rencontré une erreur :\n\n` +
        `> *${detailMsg || 'Erreur inconnue'}*\n\n` +
        `Vérifiez la configuration des modèles sur le [**Tableau de Bord IA (ai.oussamma.tn/ui)**](https://ai.oussamma.tn/ui).`;

      sendSSE('token', { token: errorMsg });
      sendSSE('done', {});
      return res.end();
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.response || aiData.content || aiData.text || '';

    if (!generatedText) {
      throw new Error('Réponse vide retournée par le modèle IA.');
    }

    // 4. Streaming fluide des tokens vers le navigateur
    const tokens = generatedText.split(/(\s+)/);
    for (const chunk of tokens) {
      sendSSE('token', { token: chunk });
      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    sendSSE('done', { usage: aiData.usage });
    res.end();
  } catch (error) {
    console.error('Erreur exécution IA:', error);
    sendSSE('error', {
      message: `Erreur lors de la communication avec le LLM : ${error.message}`,
    });
    sendSSE('done', {});
    res.end();
  }
});

// =============================================================================
// DÉMARRAGE DU SERVEUR
// =============================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================================`);
  console.log(`🔒 Application bot.oussamma.tn VERROUILLÉE par SSO`);
  console.log(`🚀 Serveur actif sur http://0.0.0.0:${PORT}`);
  console.log(`🌐 Domaine public : ${APP_URL}`);
  console.log(`🔑 SSO Base URL : ${SSO_BASE_URL}`);
  console.log(`🆔 Client ID : ${SSO_CLIENT_ID}`);
  console.log(`🤖 Proxy IA Codex : ${SSO_AI_PROMPT_ENDPOINT}`);
  console.log(`=================================================================`);
});
