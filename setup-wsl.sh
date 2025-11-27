#!/bin/bash
# Script de setup pour WSL

echo "Installation des dépendances Node.js..."
npm install

echo "Création de l'environnement virtuel Python..."
python3 -m venv venv

echo "Installation des dépendances Python..."
venv/bin/pip install opencv-python pyzbar numpy

echo "Initialisation de la base de données..."
npm run seed

echo "Setup terminé ! Lancez 'npm start' pour démarrer le serveur."

