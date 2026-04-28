# Installation

## FR

### Prérequis

- Node.js 20 ou supérieur
- npm 10 ou supérieur
- Git recommandé
- Windows 10/11 si vous ciblez les builds Electron Windows

### Installation locale

```bash
npm install
```

### Démarrage web

```bash
npm run dev
```

Ce mode lance:

- l’API locale sur `http://127.0.0.1:8787`,
- le panel admin Vite sur `http://127.0.0.1:4173`,
- le player web sur `http://127.0.0.1:4173/player?instance=1`.

### Démarrage Electron admin

```bash
npm run desktop
```

Pour un flux local avec build du panel Electron:

```bash
npm run desktop:win
```

### Démarrage Electron player

```bash
npm run desktop:player
```

### Packaging Windows

```bash
npm run package:admin:win
npm run package:player:win
```

### Documentation

```bash
npm run docs:dev
npm run docs:build
npm run docs:api
```

## EN

### Prerequisites

- Node.js 20+
- npm 10+
- Git recommended
- Windows 10/11 if you target Windows Electron packages

### Local install

```bash
npm install
```

### Web runtime

```bash
npm run dev
```

This starts:

- the local API on `http://127.0.0.1:8787`,
- the Vite admin panel on `http://127.0.0.1:4173`,
- the web player on `http://127.0.0.1:4173/player?instance=1`.

### Windows packaging

Use `npm run package:admin:win` for the all-in-one admin desktop build and `npm run package:player:win` for the dedicated fullscreen player app.
