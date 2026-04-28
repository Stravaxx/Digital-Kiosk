# Overview

## FR

Digital Kiosk pilote un parc d’écrans d’affichage dynamique avec une architecture centrée sur l’exploitation:

- enrôlement et pairing des players,
- gestion des écrans, layouts, playlists, assets et salles,
- supervision temps réel et télémétrie,
- fallback offline côté player,
- exploitation Windows via Electron admin et Electron player.

### Composants

- Admin web: React 19 + Vite
- Player web: runtime React sur `/player`
- Backend: Node.js + Express dans `server.cjs`
- Persistance: SQLite `database/system.db` + export JSON de compatibilité
- Admin desktop: Electron avec bundle serveur embarqué
- Player desktop Windows: Electron fullscreen avec identité persistée
- Terrain: application Flutter multi-plateforme

### Flux principal

1. Le player démarre avec un `deviceId` et un token persistés.
2. Il s’enrôle et demande un PIN de pairing.
3. L’admin revendique ce PIN dans l’onglet Screens.
4. Le backend autorise ensuite le player.
5. Le player récupère son layout, ses playlists et son contexte.
6. Le heartbeat maintient la visibilité temps réel et les commandes distantes.

### Points importants en 1.2.0

- Le shell Electron admin peut être packagé en mode all-in-one avec le serveur embarqué.
- Le player Windows dispose d’une app Electron dédiée, fullscreen, installable et portable.
- L’identité player est conservée via `localStorage`, IndexedDB/system KV, puis stockage Electron si disponible.
- Le panel admin Electron frameless utilise maintenant une titlebar custom fonctionnelle.

## EN

Digital Kiosk manages a signage fleet with an operations-first architecture:

- player enrollment and pairing,
- screen, layout, playlist, asset and room management,
- live monitoring and telemetry,
- offline fallback on the player side,
- Windows operations through Electron admin and Electron player apps.

### Components

- Web admin: React 19 + Vite
- Web player: React runtime served on `/player`
- Backend: Node.js + Express in `server.cjs`
- Persistence: SQLite `database/system.db` + JSON compatibility export
- Desktop admin: Electron with an embedded backend bundle
- Windows desktop player: fullscreen Electron shell with persisted identity
- Field operations: multi-platform Flutter manager
