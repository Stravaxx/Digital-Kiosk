# Exploitation

## Vérification santé système

- `GET /api/health`
- `GET /api/settings`

## Flux écran

1. Le player s’enrôle.
2. Le player obtient un PIN.
3. L’admin valide PIN dans `Screens`.
4. L’admin assigne layout/rooms.

## Résilience player (prioritaire)

- **Last known good**: le player conserve la dernière config/layout valide et l’utilise si l’API devient indisponible.
- **Préchargement média**: les assets image/vidéo sont préchargés côté player pour réduire les écrans vides.
- **Watchdog kiosk**: le script Raspberry installe un watchdog Chromium (`player-kiosk-watchdog.service`) + redémarrage auto en cas de crash.
- **Planification locale**: les éléments playlist peuvent être filtrés localement via `startAt`, `endAt`, `daysOfWeek` si ces champs sont fournis.
- **Télémétrie enrichie**: heartbeat avec CPU/RAM/température/disque/version player.

## Supervision Dashboard

- **Fleet Monitoring** (`/fleet`): état online/stale/offline + heartbeat + télémétrie.
- **Centre d’alertes** (`/alerts`): seuils configurables et alertes actives.
- **Ops** (`/ops`): SLA simplifié (disponibilité, incidents 24h, MTTR) + historique d’audit.
- **Actions groupées** (`/screens`): refresh/reload/reboot/rotation token sur sélection multiple.

## Bonnes pratiques

- Renommer chaque écran via la modale d’informations système.
- Utiliser les checkboxes de salles pour filtrer l’affichage.
- Conserver des sauvegardes de `database/system-db.json`.

## Logs et audit

- page `Logs` pour supervision,
- endpoints `/api/logs` pour extraction/filtrage,
- endpoint `/api/audit` pour journal d’audit opérationnel.
