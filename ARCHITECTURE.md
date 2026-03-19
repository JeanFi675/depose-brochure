# Architecture — Dépôt Brochures

## Vue d'ensemble

Application SPA (Single Page Application) React sans routeur. Toute la logique d'état est centralisée dans `App.jsx`. Les composants sont "dumb" (reçoivent props, appellent callbacks). Le backend est NocoDB (base de données headless avec API REST auto-générée).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Navigateur                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  App.jsx  (état global, orchestration)                   │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │   │
│  │  │ Login    │  │  Map.jsx      │  │ LocationModal    │  │   │
│  │  │ .jsx     │  │  (Leaflet)    │  │ .jsx             │  │   │
│  │  └──────────┘  └───────────────┘  └──────────────────┘  │   │
│  │                                   ┌──────────────────┐  │   │
│  │                                   │ PlaceSelector    │  │   │
│  │                                   │ Modal.jsx        │  │   │
│  │                                   └──────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  src/services/api.js                             │    │   │
│  │  │  (NocoDB CRUD + Nominatim + Overpass)            │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────┐
  │  NocoDB     │   │ OSM Nominatim   │   │ Overpass API     │
  │  (CRUD)     │   │ (géocodage inv.)│   │ (POI proches)    │
  └─────────────┘   └─────────────────┘   └──────────────────┘
```

## Structure des fichiers

```
depose-brochures/
├── index.html              # Point d'entrée HTML (lang=fr, Google Fonts)
├── vite.config.js          # Config Vite (base: '/depose-brochures/')
├── package.json
├── .env                    # VITE_API_TOKEN, VITE_APP_PASSWORD
└── src/
    ├── main.jsx            # Bootstrap React (StrictMode + createRoot)
    ├── App.jsx             # État global + orchestration des composants
    ├── index.css           # Design system "Brutal" (variables CSS, layout)
    ├── components/
    │   ├── Login.jsx           # Formulaire de connexion par mot de passe
    │   ├── Map.jsx             # Carte Leaflet + marqueurs + mode ajout
    │   ├── LocationModal.jsx   # Formulaire add/edit + commentaires
    │   └── PlaceSelectorModal.jsx  # Sélecteur de POI Overpass
    └── services/
        └── api.js          # Appels NocoDB, Nominatim, Overpass
```

## Composants

### App.jsx — Orchestrateur central

Gère l'intégralité de l'état applicatif via `useState` :

| État | Type | Rôle |
|---|---|---|
| `isAuthenticated` | bool | Déterminé par sessionStorage au chargement |
| `locations` | array | Liste brute depuis NocoDB |
| `search` | string | Filtre texte (client-side) |
| `addMode` | bool | Active le clic-pour-ajouter sur la carte |
| `pendingGPS` | `{lat,lng}` | Coordonnées du clic sur la carte |
| `showPlaceSelector` | bool | Affiche PlaceSelectorModal (étape 1) |
| `modal` | `{mode, location}` | Affiche LocationModal (étape 2) |
| `prefill` | `{title,address,gps}` | Données pré-remplies depuis POI sélectionné |
| `selectedId` | number | Lieu actuellement sélectionné |
| `flyTarget` | `[lat,lng]` | Déclenche animation carte |
| `panelCollapsed` | bool | État collapse du panneau mobile |
| `loading` | bool | Indicateur de chargement |

### Map.jsx — Carte interactive

Wrapper React-Leaflet avec 3 sous-composants internes :
- `MapClickHandler` : écoute les clics carte en `addMode`
- `FlyTo` : anime la vue vers `flyTarget` via `useEffect`
- `MapRefSetter` : expose la ref Leaflet vers le parent

Les marqueurs utilisent `divIcon` (SVG inline) pour éviter les dépendances d'images. La couleur change selon `selectedId`.

### LocationModal.jsx — Formulaire de lieu

Fonctionne en 3 modes (`mode` prop) :
- `'add'` : formulaire vide ou pré-rempli (depuis POI)
- `'edit'` : formulaire + section commentaires + suppression
- `'view'` : lecture seule (non utilisé actuellement)

Déclenche un géocodage inverse automatique si le lieu est créé en mode manuel (pas de POI sélectionné) pour auto-remplir l'adresse.

### PlaceSelectorModal.jsx — Sélecteur POI (étape 1)

Interroge l'API Overpass au montage pour trouver les lieux dans un rayon de 50m. L'utilisateur sélectionne un POI (pré-remplit le formulaire) ou clique "Pas dans la liste" (ouvre le formulaire vide avec géocodage inverse).

### api.js — Couche service

Regroupe toutes les communications réseau :

| Fonction | Protocole | Endpoint |
|---|---|---|
| `fetchLocations()` | GET | NocoDB `/records?limit=1000` |
| `createLocation(data)` | POST | NocoDB `/records` |
| `updateLocation(id, data)` | PATCH | NocoDB `/records` |
| `deleteLocation(id)` | DELETE | NocoDB `/records` |
| `reverseGeocode(lat, lng)` | GET | Nominatim `/reverse` |
| `fetchNearbyPlaces(lat, lng, r)` | POST | Overpass `/api/interpreter` |
| `parseGPS(loc)` | — | Utilitaire local |
| `stripGPS(comments)` | — | Utilitaire local |
| `addComment(existing, new)` | — | Utilitaire local |

## Flux de données principaux

### Chargement initial
```
App mount → sessionStorage check → [auth OK] → loadLocations()
  → fetchLocations() → NocoDB GET → setState(locations) → Map renders markers
```

### Création d'un lieu (flux complet)
```
User clique [+] → addMode=true → User clique carte
  → handleMapClick({lat,lng}) → pendingGPS={lat,lng}, showPlaceSelector=true
  → PlaceSelectorModal mount → fetchNearbyPlaces(lat,lng,50) → Overpass API
  → [User sélectionne POI] → handleSelectPlace(placeData)
      → reverseGeocode(lat,lng) → Nominatim
      → prefill={title, address, gps}, showPlaceSelector=false, modal={mode:'add'}
  → [OU User clique "Pas dans la liste"] → handleManualEntry()
      → modal={mode:'add'}, pendingGPS conservé, pas de prefill
  → LocationModal mount (mode add) → [si manuel] reverseGeocode auto
  → User remplit formulaire → handleSave(data)
      → createLocation(data) → NocoDB POST → loadLocations() → modal fermée
```

### Édition et commentaires
```
User clique marqueur → popup → User clique [Modifier]
  → onEditLocation(loc) → modal={mode:'edit', location:loc}
  → User ajoute commentaire → addComment(existing, new) → handleSave(data, commentOnly=true)
      → updateLocation(id, {Comments}) → NocoDB PATCH → loadLocations()
```

## Layout responsive

```
Mobile (< 768px)                    Desktop (≥ 768px)
┌──────────────────┐               ┌──────────────┬────────────────────┐
│   Top Bar        │               │ Sidebar 360px│                    │
├──────────────────┤               │ (header)     │                    │
│                  │               ├──────────────┤    MAP             │
│    MAP           │               │ Search       │    (flex: 1)       │
│    (flex: 1)     │               ├──────────────┤                    │
│                  │               │ Liste        │                    │
│    [+]           │               │ (scrollable) │    [+]             │
├──────────────────┤               │              │                    │
│ Search           │               │              │                    │
├──────────────────┤               └──────────────┴────────────────────┘
│ Liste (scroll)   │
└──────────────────┘
```

## Design system

Variables CSS définies dans `index.css` :

```css
--brutal-black:  #000000
--brutal-ice:    #8bbfd5   /* bleu clair, couleur principale */
--brutal-white:  #ffffff
--brutal-bg:     #f0f0f0   /* fond général */
--brutal-border: 3px solid black
--brutal-shadow: 5px 5px 0px black
--brutal-green:  #a8e6a3   /* zones GPS */
```

Polices : **Space Grotesk** (corps de texte), **Inter** (titres)

## API externe

| Service | Usage | Authentification |
|---|---|---|
| NocoDB self-hosted | CRUD des lieux | Token `xc-token` dans header |
| OSM Nominatim | Géocodage inverse | Aucune (gratuit) |
| Overpass API | POI à proximité | Aucune (gratuit) |

## Format des données

### Objet lieu (NocoDB)
```json
{
  "Id": 42,
  "title": "Librairie du Centre",
  "address": "12 rue de la Paix, 75001, Paris",
  "gps": "48.8692;2.3308",
  "Comments": "[19/03/2026 14:30] Premier dépôt effectué\n[20/03/2026 09:00] Stock à renouveler"
}
```

### Format commentaire
```
[DD/MM/YYYY HH:MM] Texte du commentaire
```

### Format GPS legacy (déprécié, encore supporté)
```
[GPS:48.8692,2.3308] dans le champ Comments
```

## Choix techniques

| Décision | Raison |
|---|---|
| NocoDB comme backend | Zéro code serveur, API REST auto-générée sur base de données |
| Leaflet + divIcon SVG | Pas de dépendance d'images, personnalisation totale des marqueurs |
| Flux 2 étapes (POI → formulaire) | Réduire la saisie manuelle en suggérant des lieux existants |
| Auth côté client | Simplicité — usage interne uniquement |
| CSS custom sans framework | Contrôle total du design Brutal, bundle léger |
| sessionStorage | Déconnexion automatique à la fermeture du navigateur |
| `limit=1000` NocoDB | Chargement intégral en mémoire pour filtrage instantané |

## Dette technique

- **Sécurité :** Token NocoDB et mot de passe exposés dans le bundle client
- **Pas de TypeScript :** Erreurs de type silencieuses, refactoring risqué
- **Aucun test :** Zéro couverture (unitaire, intégration, e2e)
- **Gestion d'erreurs incomplète :** Pas de feedback utilisateur en cas d'erreur réseau
- **Format GPS dual :** Complexité accidentelle (champ dédié + legacy dans commentaires)
- **Pagination absente :** `limit=1000` hardcodé — problème à grande échelle
- **`view` mode non utilisé :** Dead code dans LocationModal
- **Dépendances actuelles :** React 19, Vite 7 et React-Leaflet 5 sont très récents — surveiller les breaking changes
