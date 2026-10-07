# 🤖 bot.oussamma.tn — Assistant IA avec SSO & Recherche Web

Application web moderne d'assistance IA connectée au Single Sign-On (SSO) **sso-a.oussamma.tn**, avec intégration des modèles configurés dans le SSO, moteur de recherche web en direct et interface réactive inspirée d'Open WebUI / ChatGPT.

---

## 🌟 Fonctionnalités

1. **Authentification SSO OAuth2 / OIDC** :
   - Connexion transparente via votre SSO `https://sso-a.oussamma.tn`
   - Client ID : `client_bbe0d965db17d39880d411af`
   - Callback : `https://bot.oussamma.tn/auth/callback`
   - Récupération du profil utilisateur (Nom, Email, Avatar, Rôles)

2. **Intégration de la configuration IA du SSO** :
   - Utilise directement le LLM et les endpoints IA configurés sur votre SSO
   - Fallback multi-fournisseurs (OpenAI GPT-4o, Google Gemini, Ollama local, APIs compatibles OpenAI)
   - Configuration personnalisable à la volée par l'utilisateur depuis les paramètres

3. **Recherche Web en Direct (Web Search)** :
   - Bouton d'activation toggle direct dans la barre de prompt
   - Recherche en temps réel pour alimenter le prompt du LLM avec les actualités fraîches
   - Affichage visuel des sources et liens cliquables

4. **Interface Utilisateur Moderne (Dark Theme)** :
   - Historique des discussions (gestion multi-chats, suppression, persistance locale)
   - Streaming en temps réel mot-à-mot (SSE - Server-Sent Events)
   - Rendu Markdown complet (titres, listes, tableaux, citations)
   - Coloration syntaxique de code avec bouton de copie instantanée
   - Totalement responsive (Desktop et Mobile)

---

## 🚀 Déploiement Rapide

### Option A : Déploiement sur Coolify (coolify.oussamma.tn) 🌟

Le projet est optimisé pour **Coolify** (détection automatique Dockerfile, port 3000, et `HEALTHCHECK`).

1. **Sur votre dashboard Coolify** :
   - Cliquez sur **+ New Resource** > **Public Repository** (ou **Private Repository** lié à votre compte GitHub/GitLab).
   - Entrez l'URL de votre dépôt Git `bot.oussamma.tn`.
2. **Configuration dans Coolify** :
   - **Build Pack** : `Dockerfile` (sélectionné automatiquement).
   - **Domains** : `https://bot.oussamma.tn` (Coolify configurera automatiquement le certificat SSL Let's Encrypt et le reverse-proxy Traefik).
   - **Port** : `3000` (détecté via `EXPOSE 3000`).
   - **Healthcheck Path** : `/health`.
3. **Variables d'environnement dans Coolify** :
   Copiez-collez ces variables dans l'onglet **Environment Variables** de Coolify :
   ```env
   PORT=3000
   NODE_ENV=production
   APP_URL=https://bot.oussamma.tn
   SSO_BASE_URL=https://sso-a.oussamma.tn
   SSO_CLIENT_ID=client_bbe0d965db17d39880d411af
   SSO_CLIENT_SECRET=sec_eLi20e99kRC-hkfqC6LsxV-d4dbYzO2pyCB5g9sCIEA
   SSO_REDIRECT_URI=https://bot.oussamma.tn/auth/callback
   SSO_SCOPES=openid profile email
   SSO_AI_ENDPOINT=https://sso-a.oussamma.tn/api/ai
   SSO_AI_DEFAULT_MODEL=default-model
   SESSION_SECRET=bot-oussamma-secret-key-2026-prod
   ```
4. Cliquez sur **Deploy** ! 🚀

---

### Option B : Déploiement avec Docker Compose (Serveur VPS)

```bash
# 1. Cloner ou naviguer dans le dossier du projet
cd bot.oussamma.tn

# 2. Lancer avec Docker Compose
docker-compose up -d --build
```

L'application sera accessible immédiatement sur :
- Local : `http://localhost:3000`
- Production : `https://bot.oussamma.tn` (avec le reverse-proxy Nginx configuré)

### Option B : Démarrage avec Node.js

```bash
# Installer les dépendances
npm install

# Démarrer le serveur
npm start
```

---

## ⚙️ Variables d'Environnement (.env)

```env
PORT=3000
NODE_ENV=production
APP_URL=https://bot.oussamma.tn

# Paramètres SSO fournis
SSO_BASE_URL=https://sso-a.oussamma.tn
SSO_CLIENT_ID=client_bbe0d965db17d39880d411af
SSO_CLIENT_SECRET=sec_eLi20e99kRC-hkfqC6LsxV-d4dbYzO2pyCB5g9sCIEA
SSO_REDIRECT_URI=https://bot.oussamma.tn/auth/callback
SSO_SCOPES=openid profile email

# Endpoint IA du SSO
SSO_AI_ENDPOINT=https://sso-a.oussamma.tn/api/ai
SSO_AI_DEFAULT_MODEL=default-model

SESSION_SECRET=votre-cle-secrete-ici
```

---

## 🌐 Déploiement Production (Nginx Reverse-Proxy)

Un fichier [nginx.conf](file:///nginx.conf) prêt à l'emploi est inclus dans le projet.
Pour activer le HTTPS avec Let's Encrypt :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bot.oussamma.tn
```

---

## 📦 Lier et Pousser vers votre Compte Git

Le dépôt git local est initialisé. Pour le lier à votre compte GitHub / GitLab :

```bash
# 1. Créer un dépôt vide sur votre compte Git (ex: bot.oussamma.tn)
# 2. Lier le remote et pousser :
git remote add origin https://github.com/VOTRE_UTILISATEUR/bot.oussamma.tn.git
git branch -M main
git push -u origin main
```
