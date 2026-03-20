# Digital Kiosk v1.1.0 — Tour complet du projet (admin, player, backend, ops)

> Date: 20 mars 2026  
> Version couverte: `v1.1.0`  
> Repository: `Stravaxx/Digital-Kiosk`

## TL;DR

Digital Kiosk est une plateforme d’affichage dynamique complète:
- un **panel admin** React/Vite pour piloter le parc,
- un **player** pour l’exécution des contenus sur écran,
- une **API Node/Express** pour la logique métier,
- une **persistance SQLite (Prisma)** avec export JSON de compatibilité,
- une couche **ops/supervision** (Fleet, Alerts, Ops, Logs),
- un socle de **résilience terrain** (offline last-known-good, préchargement média, watchdog, pairing PIN/QR).

Cette release `v1.1.0` marque un vrai cap: refonte admin Vite + React Router, calendrier enrichi, pipeline de mise à jour en arrière-plan, et migration JSON → SQLite/Prisma.

---

## 1) Vision produit

L’objectif du projet est de gérer un parc d’écrans d’affichage dynamique de bout en bout:
1. enrôler des players,
2. les lier au panel admin via PIN/QR,
3. leur assigner layouts/playlists/rooms,
4. superviser leur état (online/stale/offline),
5. opérer le système à l’échelle (alertes, logs, KPI SLA, actions groupées).

Le positionnement est pragmatique: **fiabilité opérationnelle d’abord**, puis productivité admin.

---

## 2) Ce qui a changé en v1.1.0

### Ajouts majeurs
- Refonte de l’interface admin sur la stack Vite + React Router + composants Radix.
- Nouveau parcours calendrier (recherche navbar, filtres latéraux, tris date/nom/salle, reset global).
- Système de mise à jour en arrière-plan avec backup DB + storage avant exécution.
- Exposition d’un état de progression de mise à jour côté backend.
- Badge visuel “En mise à jour” dans l’admin.
- Migration des données JSON vers SQLite/Prisma (avec conservation de sauvegarde).

### Modifications structurantes
- Standardisation runtime autour de Vite pour le frontend admin.
- Simplification CI/CD GitHub (fin du build Next.js séparé).
- Packaging recentré sur build Vite + serveur Node principal.
- Vérification release GitHub alignée sur version applicative + tags semver.

### Correctifs notables
- Résolution d’erreurs TypeScript/CSS/a11y bloquantes côté admin.
- Correction routage WebSocket système en local.
- Gestion non bloquante des réponses GitHub 404 lors des checks release.
- Nettoyage des tests legacy Next.js.

---

## 3) Architecture technique

## 3.1 Macro-composants
- **Frontend admin**: React 19 + TypeScript + React Router, build Vite.
- **Frontend player**: route `/player` dans la même application frontend.
- **Backend API**: Express 5 dans `server.cjs`.
- **Storage**:
  - primaire: SQLite (`database/system.db`) via Prisma,
  - compatibilité: export JSON (`database/system-db.json`).
- **Sync temps réel**: WebSocket système (`/ws/system-sync`) pour synchronisation et reload post-update.

## 3.2 Port et runtime
- API seule: `8787` (`npm run api`).
- Frontend Vite dev/preview: `4173`.
- Mode standard local: `npm run dev` (API + panel).
- Mode “prod local”: `npm run prod` (build + start).

## 3.3 Arborescence utile
- `src-vite/app/pages/*`: pages métier admin (Dashboard, Screens, Rooms, etc.).
- `src-vite/services/*`: services front (API client, auth, playlist engine, update, ws, etc.).
- `server.cjs`: API centrale, auth/session, contenus, player, monitoring, storage, updates.
- `prisma/schema.prisma`: modèle de données relationnel.
- `kiosk-agent-cpp/*`: agent natif C++ (service/watchdog/offline).
- `docs/*`: documentation produit, exploitation, API.

---

## 4) Domaine fonctionnel (ce que fait la plateforme)

## 4.1 Pilotage de contenus
- **Layouts**: définition de zones, dimensions, orientation, mode d’affichage.
- **Playlists**: séquences d’items (image/vidéo/iframe/markdown/widgets).
- **Assets**: upload/import/suppression/serving blob, avec contraintes de politique storage.
- **Templates**: accélération de création de layouts à partir de modèles.

## 4.2 Salles & calendrier
- Gestion des **Rooms** (nom, localisation, liaison écran).
- Synchronisation de sources calendrier.
- Contrôle du rendu door display / status board.
- Parcours calendrier enrichi (recherche + filtres + tri + reset).

## 4.3 Gestion de parc écrans
- Pairing **PIN/QR** (la découverte réseau auto est volontairement retirée).
- États écran: `online`, `offline`, `stale`, `pending`.
- Commandes unitaires et bulk:
  - `refresh`,
  - `reload`,
  - `reboot`,
  - `change-layout`,
  - rotation de token.

## 4.4 Exploitation & fiabilité
- **Fleet**: monitoring parc + télémétrie (CPU/RAM/temp/disque/version).
- **Alerts**: cycle de vie `new → ack/silenced → resolved`.
- **Ops**: KPI disponibilité, incidents 24h, MTTR simplifié.
- **Logs/Audit**: journalisation technique et métier.

---

## 5) Modèle de données (Prisma / SQLite)

Le schéma couvre les entités clés:
- `Screen`, `ScreenGroup`
- `Layout`, `Zone`
- `Playlist`, `PlaylistItem`
- `Asset`
- `Room`, `CalendarSource`, `RoomTemplate`, `LocalCalendarEvent`
- `SystemSetting`, `SystemLog`
- `AdminUser`
- `StoragePolicy`, `AlertPolicy`

Points importants du design:
- indexation sur colonnes opérationnelles (statut, dates, relations),
- sérialisation JSON sur certains champs de config (thèmes, métadonnées, daysOfWeek),
- paramètres de politiques (`StoragePolicy`, `AlertPolicy`) stockés en base.

---

## 6) API backend (Express)

Le backend expose une API large, structurée autour de domaines:
- **santé et système**: `/api/health`, `/api/settings`, `/api/system/*`
- **auth admin**: `/api/auth/*` (bootstrap, login/logout, session, users)
- **contenus**: `/api/layouts`, `/api/playlists`, `/api/assets`
- **écrans & player**:
  - bootstrap/authorize/enroll/heartbeat,
  - pairing start + claim,
  - commande écran simple et bulk,
  - rotation token.
- **exploitation**:
  - `/api/monitoring/fleet`,
  - `/api/alerts` + config + actions `ack/silence`,
  - `/api/ops/sla`, `/api/logs`, `/api/audit`.
- **update système**:
  - check status,
  - déclenchement d’update,
  - état détaillé de progression.

Le service de mise à jour interroge les releases GitHub et compare les tags semver à la version applicative.

---

## 7) Sécurité & gouvernance

- Auth admin par token/session avec timeout d’inactivité (fenêtre 15–20 minutes).
- Endpoints player publics strictement ciblés.
- Routes legacy supprimées renvoyant `410` (pour expliciter la dépréciation).
- Rotation de token player (individuelle et bulk).
- Whitelist de domaines iframe configurable (fichier + variable d’environnement).

---

## 8) Résilience runtime (terrain)

Le projet traite explicitement les pannes réelles d’exploitation:
- **Last-known-good offline** côté player.
- **Préchargement intelligent** des médias.
- **Planification locale** d’items playlist (fenêtres temporelles, jours).
- **Watchdog kiosk** (notamment cible Raspberry) pour auto-récupération du renderer.
- **Sync WebSocket système** pour diffuser les changements et relancer le frontend après update.

---

## 9) Frontend admin: UX et navigation

Le shell admin repose sur:
- authentification obligatoire (hors `/player` et `/login`),
- sidebar + topbar,
- pages métiers dédiées: Dashboard, Screens, Rooms, Assets, Playlists, Calendar, Layouts, Templates, Storage, Logs, Fleet, Alerts, Ops, Settings, About,
- logique de recherche contextuelle sur Calendar,
- synchronisation locale + persistance côté client pour fluidité UX.

---

## 10) Agent natif C++ (stratégie hybride)

Le projet documente une stratégie hybride:
- agent natif C++ pour fiabilité système (service, cache, watchdog, scheduler),
- renderer web conservé pour éviter une réécriture UI lourde.

Cela permet de maximiser la robustesse d’exécution sans perdre la vélocité frontend.

---

## 11) Qualité, tests et documentation

- Tests via Vitest (`npm run test`).
- Exclusion explicite des anciens tests Next.js (`tests/next/**`).
- Documentation utilisateur/dev complète dans `docs/guide/*`.
- Documentation API générée via TypeDoc (`npm run docs:api`).

---

## 12) Déploiement et exploitation continue

Déploiement standard:
```bash
npm install
npm run prod
```

Ce mode couvre build frontend + serveur applicatif (API, admin, player) et s’aligne sur la doc d’exploitation.

Scripts utiles (exemples):
- `npm run auth:reset`
- `npm run db:migrate`
- `npm run db:migrate:from-json`
- `npm run docs:build`
- scripts de release/changelog/update dans `scripts/*`

---

## 13) Limites actuelles et prochaines étapes

Chantiers déjà identifiés:
- RBAC multi-rôles (`admin` / `operator` / `viewer`),
- versioning + rollback des layouts/playlists,
- calendrier avancé (exceptions, jours fériés, conflits),
- ACK de commandes player et amélioration du MTTR corrélé,
- centre d’alertes persistées (ack/silence/escalade) plus complet.

---

## 14) Storyboard des screenshots (à capturer)

> Les visuels ci-dessous sont prêts dans le billet; il suffit d’ajouter les fichiers image dans `docs/blog/screens/`.

### 14.1 Vue globale

![01 - Dashboard global](./screens/01-dashboard-overview.png)

### 14.2 Parc écrans

![02 - Screens list + statuts](./screens/02-screens-list.png)
![03 - Pairing PIN/QR](./screens/03-pairing-pin-qr.png)
![04 - Commandes bulk écrans](./screens/04-screens-bulk-actions.png)

### 14.3 Contenus

![05 - Layout editor](./screens/05-layouts-editor.png)
![06 - Playlists](./screens/06-playlists-management.png)
![07 - Assets library](./screens/07-assets-library.png)
![08 - Templates](./screens/08-templates.png)

### 14.4 Planning

![09 - Rooms](./screens/09-rooms.png)
![10 - Calendar avec filtres/recherche](./screens/10-calendar-filters-search.png)

### 14.5 Supervision

![11 - Fleet monitoring](./screens/11-fleet-monitoring.png)
![12 - Alerts center](./screens/12-alerts-center.png)
![13 - Ops KPI / SLA](./screens/13-ops-kpi-sla.png)
![14 - Logs & audit](./screens/14-logs-audit.png)

### 14.6 Administration système

![15 - Settings & policies](./screens/15-settings-policies.png)
![16 - Update en cours + progression](./screens/16-update-progress.png)

---

## 15) Conclusion

Digital Kiosk v1.1.0 n’est pas seulement une “UI admin plus moderne”: c’est une consolidation de plateforme autour de trois axes solides:
1. **ops-first** (monitoring, alerting, audit, update),
2. **résilience réelle** (offline, watchdog, préchargement, pairing robuste),
3. **industrialisation progressive** (Prisma/SQLite, docs structurées, pipeline simplifiée).

Si vous cherchez une base de digital signage orientée production et non démo, cette version pose des fondations très crédibles.
