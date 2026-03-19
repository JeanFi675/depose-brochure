# CLAUDE.md — Contexte pour agents IA

Ce fichier fournit le contexte nécessaire pour travailler efficacement sur ce projet.

## Qu'est-ce que ce projet ?

Application web React de gestion de **points de dépôt de brochures**. Les utilisateurs peuvent :
- Voir les points de dépôt sur une carte (Leaflet / OpenStreetMap)
- Ajouter des lieux en cliquant sur la carte
- Ajouter des commentaires horodatés sur chaque lieu
- Rechercher des lieux par nom/adresse

## Stack en un coup d'œil

- **React 19** + **Vite 7** (SPA, pas de routeur)
- **React-Leaflet 5** + **Leaflet 1.9** pour la carte
- **Axios** pour les requêtes HTTP
- **NocoDB** (self-hosted) comme backend REST
- **CSS custom** — pas de Tailwind, pas de Bootstrap. Variables dans `src/index.css`
- **Pas de TypeScript**

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/App.jsx` | État global, orchestration — tout passe par ici |
| `src/services/api.js` | Tous les appels réseau (NocoDB, Nominatim, Overpass) |
| `src/components/Map.jsx` | Carte Leaflet, marqueurs, mode ajout |
| `src/components/LocationModal.jsx` | Formulaire add/edit, commentaires |
| `src/components/PlaceSelectorModal.jsx` | Sélecteur POI (étape 1 de la création) |
| `src/index.css` | Design system complet — variables CSS, layout, composants |
| `vite.config.js` | `base: '/depose-brochures/'` — important pour les chemins |

## Conventions de code

- Composants en PascalCase, un par fichier
- État dans `App.jsx`, composants sans état interne (sauf UI locale)
- Tous les appels API dans `src/services/api.js` — ne pas faire d'appels Axios dans les composants
- Styles : utiliser les variables CSS `--brutal-*` définies dans `index.css`, ne pas écrire de couleurs hardcodées
- Pas de librairie de styles externe — le design Brutal est intentionnel et custom

## Variables d'environnement

```env
VITE_API_TOKEN=<token NocoDB>      # Header 'xc-token' sur tous les appels NocoDB
VITE_APP_PASSWORD=<mot de passe>   # Comparé côté client dans Login.jsx
```

Accessibles via `import.meta.env.VITE_*`.

## Backend NocoDB

- URL de base : `https://nocodb.jpcloudkit.fr/api/v2/tables/moe8i4skffv3orv/records`
- Auth : header `xc-token: <VITE_API_TOKEN>`
- Pas de schéma GraphQL, pas de ORM — API REST CRUD pure

### Schéma de la table

```
Id (int, PK auto)
title (text, requis)
address (text, optionnel)
gps (text, format "lat;lng", optionnel)
Comments (text long, optionnel)
```

### Format commentaires

```
[DD/MM/YYYY HH:MM] Texte\n[DD/MM/YYYY HH:MM] Autre texte
```

Utiliser la fonction `addComment(existing, newText)` de `api.js` pour ajouter un commentaire.

## Format GPS

**Format actuel (préféré) :** champ `gps` = `"48.8692;2.3308"` (point-virgule comme séparateur)

**Format legacy (toujours supporté) :** tag `[GPS:48.8692,2.3308]` dans le champ `Comments`

La fonction `parseGPS(loc)` gère les deux formats. Ne pas supprimer ce support legacy — des données existantes utilisent ce format.

## APIs externes

| Service | Usage | URL |
|---|---|---|
| Nominatim (OSM) | Géocodage inverse | `https://nominatim.openstreetmap.org/reverse` |
| Overpass API | POI à proximité (rayon 50m) | `https://overpass-api.de/api/interpreter` |

Pas d'authentification sur ces services. Respecter le rate limiting Nominatim (1 req/s).

## Flux création d'un lieu (important)

La création se fait en **2 étapes** :

1. User clique [+] → clique sur la carte → `PlaceSelectorModal` s'ouvre avec les POI Overpass
2. User sélectionne POI (pré-remplit le formulaire) OU clique "Pas dans la liste" (formulaire vide + géocodage inverse auto)
3. `LocationModal` s'ouvre en mode `'add'`
4. User sauvegarde → `handleSave()` → `createLocation()` → `loadLocations()`

Ne pas court-circuiter ce flux sans raison — il réduit la saisie manuelle.

## Layout responsive

- **Mobile < 768px :** Top bar + Map (flex:1) + panneau bas (liste)
- **Desktop ≥ 768px :** Sidebar 360px à gauche + Map (flex:1) à droite
- Le breakpoint est dans `index.css` (@media min-width: 768px)

## Pièges à éviter

1. **Ne pas modifier `vite.config.js` base** sans adapter les chemins de déploiement
2. **Ne pas stocker de secrets en dur** dans le code — tout passer par `.env`
3. **Ne pas faire d'appels API dans les composants** — tout passe par `src/services/api.js`
4. **Ne pas casser le support GPS legacy** (`[GPS:lat,lng]` dans Comments)
5. **Les marqueurs Leaflet** utilisent `divIcon` avec SVG inline — ne pas passer à des icônes image sans tester le rendu
6. **`sessionStorage['auth']`** — l'auth est vérifiée au chargement de `App.jsx` ; modifier Login.jsx implique de mettre à jour cette logique

## Commandes utiles

```bash
npm run dev      # Dev server (http://localhost:5173/depose-brochures/)
npm run build    # Build prod dans dist/
npm run preview  # Prévisualiser le build
```

## Ce qui n'existe pas encore (dette connue)

- Pas de tests (aucun fichier `.test.js`)
- Pas de TypeScript
- Pas de gestion d'erreur réseau dans l'UI (pas de toast)
- Mode `'view'` dans LocationModal non implémenté (dead code)
- Pagination NocoDB absente (`limit=1000` hardcodé)
- Auth côté client uniquement (token NocoDB exposé dans le bundle)
