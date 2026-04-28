# Troubleshooting

## FR

### Les boutons de fenêtre Electron admin ne répondent pas

- Vérifier que vous lancez bien l’admin via `npm run desktop` ou un build packagé.
- Vérifier que le preload Electron est bien chargé et que la fenêtre n’est pas ouverte dans un navigateur classique.
- Rebuilder le frontend avec `npm run build` si nécessaire.

### Le player Electron perd son token

- Relancer via `npm run desktop:player` ou le package Windows player.
- Vérifier que le dossier utilisateur Electron est accessible en écriture.
- Supprimer le fichier d’identité uniquement si vous souhaitez forcer un nouvel enrôlement.

### Le serveur embarqué ne démarre pas dans le package admin

- Regénérer le bundle avec `npm run electron:bundle`.
- Vérifier que le package a été produit avec `npm run package:admin:win`.
- Contrôler les logs runtime Electron dans le dossier utilisateur de l’application.

### Le player reste en mode enrôlement

- Vérifier `GET /api/health`.
- Vérifier l’expiration du PIN.
- Vérifier la liaison dans Screens.

### Les docs ne s’affichent pas

- Lancer `npm run docs:build`.
- Vérifier `public/docs/index.html`.
- Redémarrer le runtime web ou docs.

## EN

### Admin Electron window controls do nothing

Make sure you run the app through Electron, not through a standard browser tab. Rebuild the frontend if needed.

### The Electron player loses its token

Check write access to the Electron user data folder and relaunch the dedicated player shell.
