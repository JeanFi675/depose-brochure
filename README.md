# Dépôt Brochures

Application web de gestion des points de dépôt de brochures. Permet de créer, visualiser et commenter des lieux sur une carte interactive.

## Fonctionnalités

- Carte interactive (OpenStreetMap / Leaflet) avec marqueurs personnalisés
- Création de lieux en 2 étapes : suggestion de POI à proximité (Overpass API) puis formulaire
- Géolocalisation automatique et géocodage inverse (Nominatim)
- Système de commentaires horodatés sur chaque lieu
- Recherche côté client par nom ou adresse
- Authentification par mot de passe (session)
- Design "Brutal" : typographie bold, bordures épaisses, ombres portées

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | React 19.2 |
| Build | Vite 7.2 |
| Carte | Leaflet 1.9 + React-Leaflet 5 |
| HTTP | Axios 1.13 |
| Backend | NocoDB (API REST auto-générée) |
| Styles | CSS custom (Brutal Design) |
| Polices | Space Grotesk, Inter (Google Fonts) |

## Prérequis

- Node.js ≥ 18
- Un projet NocoDB accessible (auto-hébergé ou cloud)

## Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd depose-brochures

# Installer les dépendances
npm install
```

## Configuration

Créer un fichier `.env` à la racine :

```env
VITE_API_TOKEN=<votre-token-nocodb>
VITE_APP_PASSWORD=<mot-de-passe-de-connexion>
```

> **Attention :** Ces valeurs sont embarquées dans le bundle JS client. Ne pas mettre de secrets sensibles. Voir la section [Sécurité](#sécurité) ci-dessous.

## Lancement

```bash
# Mode développement
npm run dev
# Accessible sur http://localhost:5173/depose-brochures/

# Build production
npm run build

# Prévisualiser le build
npm run preview
```

## Déploiement

L'application est configurée pour être déployée sur un sous-chemin `/depose-brochures/` (variable `base` dans `vite.config.js`). Pour déployer à la racine, modifier cette valeur à `'/'`.

Le dossier `dist/` généré par `npm run build` peut être servi par n'importe quel serveur HTTP statique (Nginx, Apache, GitHub Pages, Netlify…).

## Structure NocoDB

La table NocoDB utilisée (`moe8i4skffv3orv`) doit contenir les colonnes suivantes :

| Colonne | Type | Description |
|---|---|---|
| `Id` | Entier | Clé primaire (auto) |
| `title` | Texte | Nom du lieu (requis) |
| `address` | Texte | Adresse postale (optionnel) |
| `gps` | Texte | Coordonnées `lat;lng` (optionnel) |
| `Comments` | Texte long | Commentaires horodatés (optionnel) |

## Usage

1. Se connecter avec le mot de passe configuré dans `.env`
2. La carte affiche tous les lieux ayant des coordonnées GPS
3. Cliquer sur un marqueur pour voir les détails
4. Cliquer sur **+** (bas droite de la carte) pour activer le mode ajout
5. Cliquer sur la carte pour choisir un emplacement → sélectionner un POI ou saisir manuellement
6. Remplir le formulaire et sauvegarder

## Sécurité

> L'authentification actuelle est **côté client uniquement**. Le token NocoDB et le mot de passe sont visibles dans le bundle JS. Cette architecture convient pour un usage interne sur réseau privé. Pour une exposition publique, il faudrait :
> - Un backend proxy pour les appels NocoDB (token jamais exposé au client)
> - Une authentification serveur (JWT, session côté serveur)

## Licence

Usage interne — tous droits réservés.
