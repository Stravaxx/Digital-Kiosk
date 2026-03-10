# Vue d’ensemble

## Objectif

Le système permet de gérer un parc d’écrans d’affichage dynamique avec:

- enrôlement d’écrans,
- assignation de layouts et playlists,
- diffusion côté player,
- supervision via dashboard admin.

## Composants

- Frontend admin React (`src/app/**`)
- Frontend player React (`/player`)
- API backend Express (`server.cjs`)
- Persistance SQLite système (`database/system.db`) + export JSON (`database/system-db.json`)

Ports cibles:

- Dev panel: `4173` (Vite)
- Dev API: `8787`
- Migration prod prévue: panel `8080`, player `80`

## Flux principal

1. Un player démarre et s’enrôle.
2. Le player demande un PIN de liaison.
3. L’admin valide le PIN dans l’onglet Screens.
4. L’écran est approuvé et reçoit son layout/playlist.

## Évolution importante

- La découverte automatique des players sur le réseau a été retirée.
- La liaison se fait uniquement via **PIN** ou **QR Code**.
- Le token player est persisté localement, puis conservé en mémoire pendant l’exécution.

## Modules prioritaires ajoutés

- Player offline **last known good** avec repli local automatique.
- Watchdog kiosk Raspberry (auto-heal Chromium + redémarrage automatique).
- Heartbeat player enrichi (CPU, RAM, température, disque, version).
- Préchargement des médias côté player et fallback si média indisponible.
- Planification locale des playlists (fenêtres temporelles) quand les métadonnées existent.
- Dashboard `Fleet Monitoring`, `Alerts`, `Ops`.
- Actions groupées d’exploitation sur écrans (commandes + rotation token).
- Historique d’audit et endpoints d’exploitation dédiés.

## Phase suivante (valeur forte)

- RBAC multi-utilisateurs (`admin` / `operator` / `viewer`).
- Versioning + rollback layouts/playlists.
- Calendrier avancé (exceptions, jours fériés, priorités, gestion de conflits).
