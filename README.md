# KeyRush

Un jeu de frappe de code pour programmeurs. Deux joueurs s'affrontent en tapant des bouts de code le plus rapidement possible.

## Prérequis

- Node.js (version 14 ou plus récente)
- Python 3 (pour le scanner QR code)
- npm (généralement installé avec Node.js)

## Installation

### Sur Windows (PowerShell)

Si tu es sur Windows et que tu utilises PowerShell :

1. **Installer les dépendances Node.js**
   ```bash
   npm install
   ```

2. **Créer l'environnement virtuel Python**
   ```bash
   py -m venv venv
   ```

3. **Installer les dépendances Python**
   ```bash
   venv\Scripts\python.exe -m pip install opencv-python pyzbar numpy
   ```

4. **Initialiser la base de données avec des données de test**
   ```bash
   npm run seed
   ```

5. **Démarrer le serveur**
   ```bash
   npm start
   ```

Le serveur devrait démarrer sur `http://localhost:3000`

### Sur WSL / Linux

Si tu utilises WSL (Windows Subsystem for Linux) ou Linux directement :

1. **Installer les dépendances Node.js**
   ```bash
   npm install
   ```

2. **Si tu as des erreurs avec sqlite3 (erreur "invalid ELF header" ou similaire)**
   
   Ça arrive souvent quand sqlite3 a été compilé pour Windows mais que tu lances depuis WSL. Reconstruis-le :
   ```bash
   npm run rebuild
   ```

3. **Créer l'environnement virtuel Python**
   ```bash
   python3 -m venv venv
   ```

4. **Installer les dépendances Python**
   ```bash
   venv/bin/pip install opencv-python pyzbar numpy
   ```

5. **Initialiser la base de données avec des données de test**
   ```bash
   npm run seed
   ```

6. **Démarrer le serveur**
   ```bash
   npm start
   ```

Le serveur devrait démarrer sur `http://localhost:3000`

**Note importante** : Si tu utilises WSL pour lancer le serveur, assure-toi d'utiliser WSL aussi pour installer les dépendances. Le venv Python créé dans Windows ne fonctionnera pas dans WSL et vice versa.

## Structure du projet

- `index.html` - Page d'accueil avec les scoreboards et l'authentification par QR code
- `game.html` - Page de jeu principale
- `server.js` - Serveur Express avec toutes les routes API
- `db.js` - Configuration de la base de données SQLite
- `seeds.js` - Script pour remplir la base de données avec des données de test
- `qr_scanner.py` - Script Python pour scanner les codes QR
- `qr_scanner_server.js` - Wrapper Node.js qui appelle le scanner Python
- `keyrush.db` - Base de données SQLite (créée automatiquement)

## Comment utiliser l'API

L'API est accessible sur `http://localhost:3000/api/`

### Endpoints disponibles

- `GET /api/snippet-records` - Récupère les meilleurs temps pour chaque snippet de code
- `GET /api/top-players` - Récupère le top 20 des joueurs par points
- `POST /api/scan-qr` - Lance le scanner QR code et authentifie/crée un joueur
- `POST /api/snippet-records` - Enregistre un nouveau record de temps pour un snippet
- `POST /api/game-wins` - Enregistre une victoire (ajoute 250 points au joueur)
- `POST /api/players` - Crée un nouveau joueur (donne 5 points d'inscription)
- `GET /api/players?name=...&session_number=...` - Trouve un joueur par nom et session

## Règles du jeu

- Une victoire rapporte **250 points**
- L'inscription (première connexion) rapporte **5 points**
- Le premier joueur à atteindre **10 points** gagne la partie
- Le timer dure **10 minutes** et démarre dès qu'un joueur commence à taper
- Les **2 joueurs doivent scanner leur QR code** avant de pouvoir commencer une partie

## Format du QR code

Le QR code doit contenir un JSON avec cette structure :

```json
{
  "nom": "Nom du joueur",
  "session": 1
}
```

Le champ `session` doit être un nombre entre 1 et 5 (représente la session au cégep).

Un autre projet est dédié à la génération de ces codes QR pour les utilisateurs.

## Problèmes courants

### Erreur "invalid ELF header" avec sqlite3

Ça arrive quand sqlite3 a été compilé pour un autre système d'exploitation. Solution :
```bash
npm run rebuild
```

### Le scanner QR ne fonctionne pas

Vérifie que :
- Le venv Python est bien créé
- Les dépendances Python sont installées (`opencv-python`, `pyzbar`, `numpy`)
- Tu utilises le bon terminal (WSL si tu lances depuis WSL, PowerShell si tu lances depuis Windows)

### La base de données est vide

Lance `npm run seed` pour remplir la base avec des données de test.

## Notes de développement

Ce projet a été fait dans le cadre d'un cours de veille technologique. C'est un projet étudiant donc le code n'est pas parfait mais ça fonctionne !
