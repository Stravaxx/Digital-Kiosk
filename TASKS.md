# TASKS - Plan complet produit (Panel + Player + Agent C++)

## Légende
- [ ] À faire
- [~] En cours
- [x] Fait

## TODOs code source détectés et traités (scan global)

- [x] `src/api/screens.ts` - validation payload inscription écran
- [x] `src/services/wsService.ts` - implémentation manager commandes/heartbeat in-memory
- [x] `src/services/roomService.ts` - liaison réunion ↔ salle (`meetingIds`)
- [x] `src/services/icalService.ts` - sync multi-sources iCal vers cache local
- [x] `src/services/eventSyncService.ts` - prise en charge `json` + `internal`
- [x] `src/services/calendarSourceService.ts` - chargement dynamique sources calendrier JSON
- [x] `src/services/calendarEngine.ts` - fusion `internal` dans agrégation événements
- [x] `src/services/templateService.ts` - assignation template ↔ salle
- [x] `src/app/pages/Dashboard.tsx` - correction overlay About (blocage panel)
- [x] `server.cjs` + `src/services/updateService.ts` + `src/app/pages/Settings.tsx` - système de MaJ basé releases GitHub (`Stravaxx/Digital-Kiosk`) avec notifications et action de mise à jour
- [x] `src/app/pages/Calendar.tsx` - filtres calendrier (date via barre glissante, ordre alphabétique A-Z/Z-A, tri par salle)
- [x] `src/app/pages/Calendar.tsx` - recherche d’événements par mots-clés

---

## 1) Agent C++ (cross-platform Linux/Windows)

### 1.1 Base architecture
- [x] Créer le workspace `kiosk-agent-cpp/`
- [x] Ajouter un `CMakeLists.txt` C++20
- [x] Ajouter les dossiers `src/`, `include/`, `config/`, `scripts/`
- [ ] Intégrer gestion de config (`agent-config.json` + overrides env)
- [ ] Ajouter journalisation structurée (niveau, rotation)
- [ ] Ajouter identifiant d’instance et bootstrap initial

### 1.2 Services système
- [ ] Linux: service `systemd` (auto-start, restart policy)
- [ ] Linux: watchdog natif (process renderer + timeout heartbeat interne)
- [ ] Windows: Windows Service (SCM start/stop/restart)
- [ ] Windows: watchdog process renderer + recovery policy

### 1.3 Synchronisation backend
- [ ] Implémenter client HTTP API (`authorize`, `bootstrap`, `heartbeat`, `rotate-token`)
- [ ] Gestion retries exponentiels + circuit breaker
- [ ] Queue offline des événements/télémétries
- [ ] Signature/validation commandes locales avant exécution

### 1.4 Cache offline (Last Known Good)
- [ ] Stocker snapshot (`screen`, `layout`, `playlists`, `assets manifest`)
- [ ] Checksum et validation de cohérence cache
- [ ] Rollback automatique vers dernier snapshot valide
- [ ] Nettoyage cache selon politique (TTL/quota)

### 1.5 Scheduler local
- [ ] Évaluer fenêtres horaires (`startAt`, `endAt`, `daysOfWeek`)
- [ ] Priorités local rules
- [ ] Fallback si calendrier distant indisponible

### 1.6 Télémétrie device
- [ ] CPU/RAM/Disque/Température/uptime/version
- [ ] Mesure latence heartbeat réelle
- [ ] Buffer local + flush en reconnexion

### 1.7 Update sécurisé agent
- [ ] Canal update signé (manifest + signature)
- [ ] Download atomique + vérification hash/signature
- [ ] Rollback binaire si échec démarrage

---

## 2) Renderer kiosk (HTML existant)

### 2.1 Linux sans desktop
- [ ] Standardiser lancement Chromium kiosk headless-compatible
- [ ] Option WPE WebKit (Cog) pour environnements DRM/KMS
- [ ] Politique redémarrage renderer via agent

### 2.2 Windows
- [ ] Host WebView2 (ou Edge kiosk) piloté par agent
- [ ] Gestion session kiosk / Assigned Access
- [ ] Restart policy sur crash renderer

### 2.3 Contrat Agent ↔ Renderer
- [ ] API locale (localhost IPC) pour commandes (`refresh`, `reload`, `reboot`, `change-layout`)
- [ ] Endpoint local santé renderer (`/healthz`)
- [ ] Heartbeat interne Agent ↔ Renderer

---

## 3) Backend/API (Node)

### 3.1 Fiabilité ops
- [x] Fleet monitoring endpoint
- [x] Alerts config + alerts list endpoint
- [x] Ops SLA endpoint
- [x] Audit endpoint
- [x] Bulk commands + bulk rotate token
- [x] Command ACK endpoint (player confirme exécution)
- [x] Retry server-side des commandes non ackées

### 3.2 Alerting avancé
- [x] Persistance cycle de vie alerte (new/ack/silenced/resolved)
- [ ] Escalade multi-seuils et suppression bruit
- [ ] Notification channels (webhook/email/teams/slack)
- [ ] Historisation longue durée des incidents/alertes (12+ mois)

### 3.3 Sécurité
- [ ] Rotation périodique secret signature commandes
- [ ] Expiration stricte signatures (window)
- [ ] Anti-replay nonce + store court terme
- [ ] Hardening headers/CORS par mode déploiement
- [ ] Politique mot de passe configurable (complexité, expiration, historique)
- [ ] Verrouillage anti-bruteforce (tentatives, cooldown, backoff)
- [ ] Secrets externalisés (vault/env sécurisé) + rotation planifiée
- [ ] Audit renforcé par rôle (admin/operator/viewer) avec traçabilité complète

### 3.4 Données
- [ ] Timeseries télémétrie 7/30/90 jours
- [ ] Index/retention SQLite ops
- [ ] Export/import backup complet versionné
- [ ] Historisation longue durée télémétrie/SLO (rétention configurable, agrégations)
- [ ] Vérification d'intégrité backup (checksum + test restauration automatique)
- [ ] Procédure rollback documentée et testée (runbook + exercice périodique)

---

## 4) Panel Admin (React)

### 4.1 Fleet/Alerts/Ops
- [x] Pages Fleet, Alerts, Ops
- [x] Actions groupées dans Screens
- [ ] Graphiques tendance (24h/7j) pour CPU/RAM/disponibilité
- [ ] Drill-down player (timeline incidents + commandes)
- [x] ACK/Silence alertes depuis UI
- [ ] Dashboards SLO avec tendances (disponibilité, latence heartbeat, MTTR)
- [ ] Filtres incidents (sévérité, type, période, screen, état)

### 4.2 UX productivité
- [ ] Filtres avancés multi-critères dans Fleet/Screens
- [ ] Sauvegarde vues personnalisées opérateurs
- [ ] Export CSV/PDF des incidents et SLA
- [ ] Statut visuel des commandes dans Screens (en attente, retry, acquittée, échouée)

### 4.3 RBAC (phase suivante)
- [ ] Rôles `admin` / `operator` / `viewer`
- [ ] Permissions granulaire par feature
- [ ] Audit des actions sensibles par rôle

### 4.4 Layout/Playlist lifecycle
- [ ] Versioning revisions (draft/published)
- [ ] Rollback en 1 clic
- [ ] Diff visuel entre versions

---

## 5) Player Web (React `/player`)

### 5.1 Runtime
- [x] Last known good fallback
- [x] Préchargement média best-effort
- [x] Télémétrie enrichie heartbeat
- [x] Planification locale basique
- [ ] Gestion explicite command ACK
- [ ] Mécanisme anti-freeze (soft reset zone)

### 5.2 Médias
- [ ] Retry intelligent par type asset
- [ ] Politique fallback asset (image de secours)
- [ ] Détection média corrompu + quarantaine locale

### 5.3 Performance
- [ ] Metrics FPS/render stalls
- [ ] Stratégie mémoire agressive long run
- [ ] Profil low-power ARM optimisé

---

## 6) QA / Tests / Qualité

- [ ] Tests API contract (alerts, fleet, ops, bulk)
- [ ] Tests player offline/online transitions
- [ ] Tests endurance 24h/72h kiosk
- [ ] Tests migration data et rollback
- [ ] Tests sécurité signatures/replay
- [ ] Tests E2E critiques: login, pairing, heartbeat, commandes, multiuser
- [ ] Tests de charge: simulation 100+ players (heartbeat + commandes + dashboards)
- [ ] Tests de reprise après coupure réseau (player, backend, resync)

---

## 7) DevOps / Delivery

- [x] Pipelines build panel/player/backend + agent C++
- [ ] Artifacts signés (Node bundle + C++ binaries)
- [x] Publication release channels (stable/canary)
- [ ] Playbooks incident + runbooks opérationnels

### 7.x CI/CD ajoutés (2026-03-18)
- [x] Workflow GitHub CI (build complet + tests)
- [x] Workflow GitHub Release (bundle runtime minimal + release automatique)
- [x] Génération automatique de `CHANGELOG.md` listant commits et fichiers modifiés

---

## 8) Documentation complète

- [x] API de base mise à jour
- [x] Docs ops/fleet/alerts/ops mises à jour
- [ ] Guide install agent C++ Linux systemd
- [ ] Guide install agent C++ Windows Service
- [ ] Guide migration progressive (web player -> agent)
- [ ] Matrice de compatibilité hardware/OS
