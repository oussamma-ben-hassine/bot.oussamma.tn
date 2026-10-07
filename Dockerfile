FROM node:20-alpine

# Répertoire de travail
WORKDIR /app

# Copie des définitions de paquets
COPY package.json ./

# Installation des dépendances de production
RUN npm install --production

# Copie du code source
COPY server.js ./
COPY public ./public

# Exposer le port
EXPOSE 3000

# Healthcheck détecté par Coolify / Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Variables d'environnement intégrées directement (aucun ajout manuel requis dans Coolify)
ENV PORT=3000 \
    NODE_ENV=production \
    APP_URL=https://bot.oussamma.tn \
    SSO_BASE_URL=https://sso-a.oussamma.tn \
    SSO_CLIENT_ID=client_bbe0d965db17d39880d411af \
    SSO_CLIENT_SECRET=sec_eLi20e99kRC-hkfqC6LsxV-d4dbYzO2pyCB5g9sCIEA \
    SSO_REDIRECT_URI=https://bot.oussamma.tn/auth/callback \
    SSO_SCOPES="openid profile email" \
    SSO_AI_ENDPOINT=https://sso-a.oussamma.tn/api/v1/integrations/ai/prompt \
    SSO_AI_PROVIDER=openai_codex \
    SSO_AI_DEFAULT_MODEL=gpt-4o \
    SESSION_SECRET=bot-oussamma-super-secret-key-2026-prod

# Commande de démarrage
CMD ["node", "server.js"]
