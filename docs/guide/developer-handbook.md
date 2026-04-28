# Developer Handbook

## FR

### Périmètre technique

Le repo contient aujourd’hui:

- panel web admin React + Vite,
- player web,
- backend Express + SQLite,
- shell Electron admin avec bundle serveur embarqué,
- app Electron player Windows fullscreen,
- manager Flutter multi-plateforme,
- agent natif C++.

### Commandes de base

```bash
npm install
npm run dev
npm run build
npm run desktop
npm run desktop:player
npm run package:admin:win
npm run package:player:win
```

### Architecture backend

Domaines principaux:

- Auth et permissions: `/api/auth/*`
- Mobile connect: `/api/mobile/connect/*`
- Contenu: `/api/assets`, `/api/playlists`, `/api/layouts`, `/api/meetings`
- Player et écrans: `/api/player/*`, `/api/screens/*`
- Monitoring et exploitation: `/api/monitoring/*`, `/api/alerts/*`, `/api/ops/*`, `/api/audit`
- Système: `/api/system/*`, `/api/storage/*`, `/api/logs`

### Architecture Electron

Admin desktop:

- point d’entrée: `electron/main.cjs`,
- renderer dédié: `electron/dist/`,
- preload admin: `electron/preload.cjs`,
- preload player: `electron/preload-player.cjs`,
- bundle serveur embarqué: `electron/app-bundle/` généré par `scripts/prepare-electron-bundle.cjs`.

Player desktop:

- point d’entrée: `electron/player-main.cjs`,
- fenêtre Electron fullscreen,
- stockage identité player dans le dossier utilisateur.

### Validation conseillée

```bash
npm run build
npm run test
npm run docs:build
node --check electron/main.cjs
node --check electron/player-main.cjs
```

### Avant merge

- Vérifier les flows web et Electron impactés.
- Vérifier le pairing player et la restauration du token.
- Vérifier le packaging `--dir` ou le package Windows ciblé si la modification touche Electron.
- Maintenir le README, le changelog et les guides synchronisés.

## EN

The repository now spans web, Electron, Flutter and C++ surfaces. If you change Electron, validate both the admin shell and the dedicated player shell. If you change player identity or pairing, validate the token restore path and the PIN workflow.

Whenever endpoints or runtime flows change, update the main guides and the API reference in the same branch.
