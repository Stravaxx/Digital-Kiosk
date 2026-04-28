# Addons recommandés (Roadmap d'amélioration)

Ce document propose des améliorations concrètes pour chaque composant du projet Digital Kiosk.

## 1) Manager Electron (Windows)

### Priorité haute

- Superviser la santé du backend avec redémarrage progressif (backoff) au lieu d'un redémarrage immédiat constant.
- Ajouter un écran de diagnostic local (CPU/RAM process Electron + backend + statut WS).
- Intégrer les logs serveur dans la fenêtre Electron avec filtres niveau/source.
- Ajouter une sauvegarde automatique de configuration avant update.

### Valeur produit

- Mode kiosk verrouillé optionnel (masquage barre, raccourcis limités).
- Mise à jour auto de l'app Electron avec canal stable/beta.
- Télémetry locale anonymisée (crash + performance) activable.

## 2) Application Web (Admin + Player)

### Priorité haute

- Couvrir 100% des textes UI en i18n avec extraction centralisée (FR/EN).
- Ajouter une vue d'historique des commandes écran (queued, sent, ack, failed).
- Ajouter pagination/virtualisation sur grosses listes (assets, logs, screens).
- Ajouter validation stricte des formulaires (messages utilisateur homogènes).

### Valeur produit

- Mode compact opérateur (actions principales, peu de bruit visuel).
- Widgets dashboard personnalisables (drag and drop + persist user profile).
- Thèmes entreprise (branding, logo, couleurs) par organisation.

## 3) Serveur Node/Express

### Priorité haute

- Ajouter rate-limiting et anti-abus sur routes publiques (pairing, mobile connect).
- Ajouter OpenAPI versionnée (source de vérité) et génération de clients.
- Renforcer observabilité (correlationId, métriques endpoint, latence p95/p99).
- Ajouter tests d'intégration API pour tous les domaines (auth, player, assets, ops).

### Valeur produit

- RBAC fin par permission (admin/operator/viewer + scopes).
- Journal d'audit enrichi (avant/après sur changements critiques).
- Rotation automatique des clés API avec politique d'expiration.

## 4) Application Flutter

### Priorité haute

- Finaliser la traduction FR/EN sur toutes les pages (fallback par défaut FR).
- Ajouter formulaires complets (réservations, playlists, assets) avec validation locale.
- Ajouter affichage des erreurs réseau sous forme de bannières réessayables.
- Ajouter synchronisation en arrière-plan (refresh discret + timestamp de fraîcheur).

### Valeur produit

- Push local notifications (commandes, alertes, update status).
- Support offline partiel: cache lecture + reprise en ligne.
- Mode tablette compact pour exploitation terrain.

## 5) Agent C++ / Runtime kiosks

### Priorité haute

- ACK de commandes signé avec horodatage et anti-replay.
- Profil de redémarrage intelligent (éviter boucle reboot).
- Diagnostic matériel (température, stockage, connectivité).

## 6) Sécurité & conformité

- Politique CSP stricte sur iframe + whitelist dynamique signée.
- Rotation et révocation de token player et API key.
- Checklist hardening système (ports, services, permissions fichiers).
- Sauvegardes chiffrées + procédure de restauration testée.

## 7) CI/CD & Qualité

- Pipeline CI unique: lint + tests + build web + build flutter + docs.
- Vérification automatique des exemples API documentés (tests contractuels).
- Publication docs versionnées (v1, v1.1, vNext).

## 8) Plan de livraison conseillé

- Sprint 1: sécurité API + observabilité + i18n complète.
- Sprint 2: commandes écrans robustes + historique + validations formulaires.
- Sprint 3: offline mobile/flutter + branding + performance listes.
- Sprint 4: OpenAPI + SDK clients + durcissement exploitation.
