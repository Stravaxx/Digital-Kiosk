<p align="center">
	<img src="https://capsule-render.vercel.app/api?type=waving&color=0:020617,40:0f172a,100:0ea5e9&height=210&section=header&text=Digital%20Kiosk&fontSize=46&fontColor=ffffff&desc=Admin%20panel%20%E2%80%A2%20Player%20runtime%20%E2%80%A2%20Electron%20desktop%20%E2%80%A2%20Flutter%20manager&descAlignY=66&animation=fadeIn" alt="Digital Kiosk banner" />
</p>

<p align="center">
	<img src="https://img.shields.io/badge/version-1.2.0-0ea5e9?style=for-the-badge" alt="Version 1.2.0" />
	<img src="https://img.shields.io/badge/platform-Web%20%7C%20Electron%20%7C%20Flutter-0f172a?style=for-the-badge" alt="Platforms" />
	<img src="https://img.shields.io/badge/backend-Node.js%20%2B%20Express-22c55e?style=for-the-badge" alt="Backend" />
	<img src="https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-f59e0b?style=for-the-badge" alt="Frontend" />
</p>

<p align="center">
	<img src="public/branding/kiosk-icon.svg" alt="Digital Kiosk icon" width="92" height="92" />
</p>

# Digital Kiosk

Digital Kiosk est une plateforme d’affichage dynamique orientée exploitation locale et terrain. Le repo regroupe le panel d’administration web, le player, l’API Node.js, un shell Electron admin tout-en-un, une app Electron player Windows plein écran et un manager Flutter multi-plateforme.

Digital Kiosk is a signage platform focused on local operations and field usage. This repository contains the web admin panel, the player runtime, the Node.js API, an all-in-one Electron admin shell, a fullscreen Windows Electron player app, and a multi-platform Flutter manager.

## Highlights

- Admin panel React + Vite avec permissions, monitoring temps réel, update monitor et RBAC avancé.
- Player web avec fallback last-known-good, heartbeat enrichi, cache média et pairing PIN/QR.
- Shell Electron admin qui embarque le serveur Digital Kiosk et stocke les données runtime dans le dossier utilisateur.
- App Electron player Windows dédiée, fullscreen, persistante, installable ou portable.
- Client Flutter MD3 pour Windows, macOS, Linux, Android et iOS.

## Quick Start

### FR

```bash
npm install
npm run dev
```

Services par défaut:

- Admin web: http://127.0.0.1:4173
- API: http://127.0.0.1:8787
- Player web: http://127.0.0.1:4173/player?instance=1
- Docs VitePress: http://127.0.0.1:5173 si `npm run docs:dev` est lancé séparément

### EN

```bash
npm install
npm run dev
```

Default services:

- Web admin: http://127.0.0.1:4173
- API: http://127.0.0.1:8787
- Web player: http://127.0.0.1:4173/player?instance=1
- VitePress docs: http://127.0.0.1:5173 when `npm run docs:dev` is started separately

## Runtime Matrix

| Surface | Stack | Purpose |
| --- | --- | --- |
| Web admin | React 19 + Vite + Radix | Operations, content, fleet, alerts, settings |
| Web player | React runtime | Layout rendering, media playback, telemetry |
| API | Node.js + Express + SQLite | Persistence, auth, sync, updates, player endpoints |
| Electron admin | Electron + embedded server bundle | Windows all-in-one local supervision |
| Electron player | Electron fullscreen shell | Windows signage player with persisted identity |
| Mobile/Desktop manager | Flutter | Field management, mobile connect, approval flow |

## Core Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start API + Vite admin panel |
| `npm run dev:ip` | Same as dev, exposed on `0.0.0.0` |
| `npm run build` | Build the web application |
| `npm run prod` | Build and serve production web runtime |
| `npm run desktop` | Run the Electron admin manager in dev |
| `npm run desktop:win` | Build web + Electron renderer, then run Electron admin |
| `npm run desktop:player` | Run the dedicated Electron player shell |
| `npm run electron:bundle` | Prepare the embedded backend bundle for packaging |
| `npm run package:admin:win` | Build Windows admin installer + portable package |
| `npm run package:player:win` | Build Windows player installer + portable package |
| `npm run flutter:devices` | List Flutter devices for the manager app |
| `npm run flutter:run:android` | Run the Flutter manager on Android |
| `npm run flutter:run:ios` | Run the Flutter manager on iOS |
| `npm run flutter:run:linux` | Run the Flutter manager on Linux |
| `npm run flutter:run:macos` | Run the Flutter manager on macOS |
| `npm run flutter:run:windows:workaround` | Run the Flutter manager on Windows via the NTFS mirror workaround |
| `npm run flutter:build:linux` | Build the Flutter manager for Linux |
| `npm run flutter:build:macos` | Build the Flutter manager for macOS |
| `npm run flutter:build:windows:workaround` | Build the Flutter manager for Windows via the NTFS mirror workaround |
| `npm run flutter:build:apk:workaround` | Build the Flutter manager APK via the Windows workaround |
| `npm run flutter:build:appbundle:workaround` | Build the Flutter manager Android App Bundle via the Windows workaround |
| `npm run docs:dev` | Start VitePress docs server |
| `npm run docs:build` | Build VitePress documentation |
| `npm run docs:api` | Generate TypeDoc API reference |
| `npm run test` | Run Vitest suite |
| `npm run api:verify` | Verify critical API endpoints |

## Windows Packaging

### Admin all-in-one

Le package admin Windows embarque désormais le serveur Digital Kiosk dans l’application Electron. Au runtime, le shell:

- prépare un bundle applicatif interne via `scripts/prepare-electron-bundle.cjs`,
- lance `server.cjs` depuis ce bundle embarqué,
- écrit la base et le storage dans le dossier utilisateur Electron,
- expose le panel admin frameless avec boutons minimise/maximise/fermeture fonctionnels,
- ouvre le player Electron avec session persistante.

Build command:

```bash
npm run package:admin:win
```

### Player Windows

L’app Electron player Windows:

- s’ouvre en plein écran,
- persiste l’identité du player hors `localStorage`,
- recharge le token au prochain démarrage,
- supporte les builds installables et portables.

Build command:

```bash
npm run package:player:win
```

Raccourcis player:

- `F11`: activer/désactiver le plein écran
- `Ctrl+Alt+R`: recharger le player
- `Ctrl+Alt+Q`: quitter l’app

## Documentation

Documentation hub:

- [docs/index.md](docs/index.md)
- [docs/guide/overview.md](docs/guide/overview.md)
- [docs/guide/installation.md](docs/guide/installation.md)
- [docs/guide/user-manual.md](docs/guide/user-manual.md)
- [docs/guide/developer-handbook.md](docs/guide/developer-handbook.md)
- [docs/reference/api.md](docs/reference/api.md)

## Data & Persistence

- Main runtime database: `database/system.db`
- JSON compatibility export: `database/system-db.json`
- Electron admin packaged runtime data: `%APPDATA%/Digital Kiosk Desktop/runtime/`
- Electron player identity store: `%APPDATA%/Digital Kiosk Player/players/`

Le player conserve désormais son identité sur trois couches quand elles sont disponibles: `localStorage`, IndexedDB/system KV, puis stockage Electron sur Windows.

## Flutter Manager

Le client Flutter situé dans `Digital Kiosk Manager/` couvre:

- Windows
- macOS
- Linux
- Android
- iOS

Commandes utiles depuis la racine du repo:

- `npm run flutter:devices`
- `npm run flutter:run:windows:workaround`
- `npm run flutter:run:linux`
- `npm run flutter:run:macos`
- `npm run flutter:run:android`
- `npm run flutter:run:ios`

Builds utiles:

- `npm run flutter:build:windows:workaround`
- `npm run flutter:build:linux`
- `npm run flutter:build:macos`
- `npm run flutter:build:apk:workaround`
- `npm run flutter:build:appbundle:workaround`

Remarque: il n’y a pas de cible web Flutter dans ce repo actuellement. Windows continue d’utiliser le contournement NTFS pour éviter l’échec de symlink plugin quand le SDK Flutter et le projet sont sur des volumes différents.

Connexion mobile:

1. L’utilisateur saisit l’URL de l’instance.
2. L’application initie une demande de connexion mobile.
3. Un admin approuve la demande.
4. Le backend émet une clé API.
5. L’application réutilise cette clé en `X-API-Key`.

## Environment Notes

Si le frontend et l’API ne partagent pas la même origine, définir `VITE_ADMIN_API_BASE`.

Exemple PowerShell:

```powershell
$env:VITE_ADMIN_API_BASE = "http://127.0.0.1:8787"
npm run dev
```

Whitelist iframe:

1. Valeurs intégrées.
2. Fichier `database/iframe-domain-whitelist.json`.
3. Variable `IFRAME_DOMAIN_WHITELIST` au format CSV.

## Roadmap Snapshot

- Finaliser les métriques SLA corrélées et les ACK de commandes player.
- Ajouter les alertes persistées avec silence/escalade.
- Étendre le versioning + rollback des layouts/playlists.
- Approfondir le calendrier avancé avec exceptions et priorités.

## Useful Links

- [CHANGELOG.md](CHANGELOG.md)
- [docs/guide/player-pairing.md](docs/guide/player-pairing.md)
- [docs/guide/troubleshooting.md](docs/guide/troubleshooting.md)
- [flutter_kiosk_manager/README.md](flutter_kiosk_manager/README.md)
