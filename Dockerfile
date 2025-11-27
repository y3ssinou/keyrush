FROM node:18-slim

# Installer les dépendances système nécessaires pour compiler sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libatomic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances npm
RUN npm install

# Copier le reste de l'application
COPY . .

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["node", "server.js"]

