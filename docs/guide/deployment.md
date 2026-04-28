# Deployment

## FR

### Option 1. Déploiement web standard

```bash
npm install
npm run build
npm run prod
```

À utiliser pour un déploiement Node.js classique lorsque l’API et le panel tournent depuis le projet.

### Option 2. Admin Windows tout-en-un

```bash
npm run package:admin:win
```

Ce package:

- embarque `server.cjs` et les ressources nécessaires,
- prépare un bundle interne pour l’application Electron,
- stocke la base et le storage dans le dossier utilisateur au runtime,
- génère un format installable et un format portable.

### Option 3. Player Windows dédié

```bash
npm run package:player:win
```

Ce package fournit un player fullscreen Electron qui persiste son identité localement.

### Variables utiles

- `VITE_ADMIN_API_BASE`
- `IFRAME_DOMAIN_WHITELIST`
- `UPDATE_API_KEY` ou `UPDATE_BEARER_TOKEN`
- `DIGITAL_KIOSK_PLAYER_URL` pour surcharger l’URL du player Electron dédié

## EN

### Option 1. Standard web deployment

Run `npm run build` then `npm run prod` when you want a classic Node.js deployment from the repository.

### Option 2. All-in-one Windows admin package

Run `npm run package:admin:win` to generate Windows admin artifacts with the embedded backend bundle.

### Option 3. Dedicated Windows player package

Run `npm run package:player:win` to generate the fullscreen Windows player artifacts.
