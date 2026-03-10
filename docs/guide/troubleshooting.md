# Dépannage

## Les docs ne s’affichent pas

- Vérifier `npm run docs:build`.
- Vérifier présence de `public/docs/index.html`.
- Redémarrer `npm run dev` ou `npm run prod`.

## Le player reste en mode enrôlement

- Vérifier `GET /api/health`.
- Vérifier que le PIN n’est pas expiré (5 min).
- Vérifier la liaison dans `Screens`.

## Erreur d’auth admin

- Vérifier `POST /api/auth/login`.
- Utiliser `npm run auth:reset` si nécessaire.
- Vérifier l’expiration de session inactivité.
