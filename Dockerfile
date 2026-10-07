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

# Variables d'environnement par défaut
ENV PORT=3000
ENV NODE_ENV=production

# Commande de démarrage
CMD ["node", "server.js"]
