# Mode dev/prod (tout-en-un)

## Démarrage développement complet

Commande unique:

```bash
npm run dev
```

Ce que la commande initialise automatiquement:

- **API**: `http://127.0.0.1:8787`
- **Frontend Admin**: `http://127.0.0.1:5173`
- **Player** (même frontend): `http://127.0.0.1:5173/player?instance=1`
- **Documentation** (pré-générée et servie par Vite): `http://127.0.0.1:5173/docs/`
- **Documentation API** (TypeDoc intégré): `http://127.0.0.1:5173/docs/api/index.html`

## Démarrage production complet

Commande unique:

```bash
npm run prod
```

Ce que la commande initialise automatiquement:

- build docs complet (`preprod`),
- build frontend,
- serveur API + frontend + player + docs.

URL de référence en prod:

- **Admin**: `http://127.0.0.1:4173/`
- **Player**: `http://127.0.0.1:4173/player?instance=1`
- **Docs**: `http://127.0.0.1:4173/docs/`
- **API docs**: `http://127.0.0.1:4173/docs/api/index.html`

## Alias explicites

- `npm run dev:all` → alias de `npm run dev`
- `npm run prod:all` → alias de `npm run prod`
