# Guide développeur

## Objectif

Ce guide sert de référence technique pour développer et maintenir l’application.

## Stack technique

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express (`server.cjs`)
- Stockage principal: SQLite (`database/system.db`)
- Export compatibilité: JSON (`database/system-db.json`)

## Démarrage dev

```bash
npm install
npm run dev
```

Services attendus:

- API: `http://127.0.0.1:8787`
- Panel: `http://127.0.0.1:4173`

## Structure du projet

- `src/app/**`: interfaces admin
- `src/app/pages/Player.tsx`: runtime d’affichage player
- `src/services/**`: services métier front
- `server.cjs`: API backend + règles d’accès + persistance
- `docs/**`: documentation fonctionnelle/technique
- `tests/**`: tests unitaires/intégration

## Conventions de code

- Corriger la cause racine avant les symptômes.
- Préserver les API publiques existantes.
- Ajouter des commentaires orientés intention (le « pourquoi »).
- Éviter les commentaires triviaux (le « quoi » évident).

### Commentaires recommandés

- sections critiques de sécurité (auth/session/token),
- moteurs d’animation et scheduling,
- fallback offline et gestion d’état distribué,
- conversions de données potentiellement ambiguës.

## Workflow recommandé

1. Créer une branche de travail.
2. Implémenter un changement minimal et ciblé.
3. Vérifier compilation (`npm run build`).
4. Vérifier comportement fonctionnel (écran admin + player).
5. Mettre à jour la documentation associée.

## Variables d’environnement

Exemples fréquents:

- `VITE_ADMIN_API_BASE`
- `API_ONLY`
- `PORT`
- `SYSTEM_DB_DIR`
- `SYSTEM_STORAGE_DIR`
- `IFRAME_DOMAIN_WHITELIST`

## Développement API

Le backend est organisé par domaines:

- auth/session,
- contenu (layouts/playlists/assets),
- player/screens,
- monitoring/alerts/ops,
- storage/system.

Bonnes pratiques:

- valider toutes les entrées (`req.body`, `req.params`, `req.query`),
- renvoyer des erreurs explicites et stables,
- journaliser les actions sensibles,
- conserver la compatibilité avec le player déployé.

## Développement player

Points critiques:

- robustesse offline (fallback last-known-good),
- rendu déterministe des layouts,
- auto-scroll/animations fluides (`requestAnimationFrame`),
- reprise propre après changement de données.

## Tests et validation

Commandes utiles:

```bash
npm run test
npm run build
npm run docs:build
```

Avant merge:

- vérifier au moins un scénario pairing complet,
- vérifier un scénario player offline,
- vérifier une commande écran (refresh/reload/reboot).

## Erreurs fréquentes côté dev

### `401 missing token`

Cause: route protégée appelée sans session admin.

### `401 session expired`

Cause: timeout d’inactivité session admin.

### `410` sur routes screens legacy

Cause: endpoints conservés pour compat mais fonction retirée (découverte réseau).

### Build OK mais comportement runtime incorrect

Vérifier:

- mode server (`API_ONLY`, `SERVER_MODE`),
- données persistées (`database/system.db`),
- cohérence `layout`/`playlist`/`assets`.

## Maintenance documentation

À chaque évolution fonctionnelle:

1. mettre à jour `docs/reference/api.md` pour tout changement d’endpoint,
2. mettre à jour le guide utilisateur si le parcours change,
3. ajouter au dépannage (`docs/guide/troubleshooting.md`) les nouvelles erreurs connues.
