# Digital Kiosk

Projet Digital Signage (panel admin + player).

## Running the code

Installez les dépendances:

- `npm i`

Commandes principales:

- `npm run dev` : API `:8787` + panel Vite `:4173`
- `npm run dev:ip` : idem avec exposition réseau (`0.0.0.0`)
- `npm run prod` : build + serveur prod
- `npm run panel:prod` : panel prod sur `:8080` (préparation migration)
- `npm run player:prod` : API player sur `:80` (préparation migration)

Si frontend et API sont sur des origines différentes, définir `VITE_ADMIN_API_BASE`.

Exemple PowerShell:

```powershell
$env:VITE_ADMIN_API_BASE="http://127.0.0.1:8787"
npm run dev
```

## Documentation

- `npm run docs:dev` : serveur docs
- `npm run docs:api` : génération API TypeDoc
- `npm run docs:build` : build docs
- `npm run docs:preview` : preview docs

Guides principaux:

- `docs/index.md` : point d'entrée documentation
- `docs/guide/user-manual.md` : guide utilisateur complet (admin + player)
- `docs/guide/developer-handbook.md` : guide développeur (architecture, conventions, workflows)
- `docs/reference/api.md` : référence API complète (endpoints, exemples, erreurs)

## Stockage système

- Backend principal: SQLite local (`database/system.db`) sans serveur externe.
- Export de compatibilité: JSON système (`database/system-db.json`).
- Fichier legacy retiré: `database/db.json`.

## Fonctionnalités opérationnelles ajoutées

- Player offline `last-known-good` (fallback local si API indisponible).
- Heartbeat enrichi (CPU/RAM/température/disque/version).
- Préchargement intelligent des médias côté player.
- Fleet monitoring (`/fleet`), alertes (`/alerts`), Ops/SLA + audit (`/ops`).
- Actions groupées écrans (refresh/reload/reboot/rotation token).
- Script Raspberry renforcé avec watchdog Chromium + reboot planifié optionnel.

## Tâches à faire (roadmap)

### Priorité haute

- Finaliser métriques SLA avancées (MTTR réel par incident corrélé).
- Ajouter accusés de réception de commandes player (command ACK).
- Ajouter vue d’alertes persistées (ack/silence/escalade).

### Phase suivante

- RBAC multi-utilisateurs (`admin` / `operator` / `viewer`).
- Versioning + rollback layouts/playlists.
- Calendrier avancé (exceptions, jours fériés, priorités, conflits).

Roadmap exhaustive exécutable:

- `TASKS.md` (backend + panel + player + agent C++ + devops + docs)
- `docs/guide/kiosk-agent-cpp.md` (architecture et bootstrap agent natif)

Scripts agent C++:

- `npm run agent:cpp:configure`
- `npm run agent:cpp:build`
- `npm run agent:cpp:run`

## Configuration iframe whitelist

La whitelist peut être configurée via:

1. Valeurs par défaut intégrées.
2. Fichier `database/iframe-domain-whitelist.json`.
3. Variable d'environnement `IFRAME_DOMAIN_WHITELIST` (CSV).

Exemple:

```powershell
$env:IFRAME_DOMAIN_WHITELIST="intranet.mon-entreprise.com,blog.client.com"
npm run dev
```

## Production

- `npm install`
- `npm run prod`
