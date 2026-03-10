# Manuel utilisateur — Screens

## Objectif

Gérer le parc d’écrans: liaison, état, commandes.

## Fonctions principales

- lister les écrans,
- vérifier le statut (`online`, `offline`, `pending`),
- envoyer des commandes (`refresh`, `reload`, `reboot`, `change-layout`),
- actions groupées (bulk) et rotation de token.

## Procédure de liaison (PIN/QR)

1. Démarrer le player.
2. Récupérer le PIN affiché.
3. Valider le PIN dans le panel.
4. Vérifier que l’écran passe en `online`.

## Bonnes pratiques

- nommer clairement chaque écran,
- éviter les commandes bulk en heures sensibles,
- faire une rotation token après incident sécurité.

## Erreurs fréquentes

- **PIN expiré**: relancer le pairing depuis le player.
- **Écran reste pending**: vérifier réseau + token + heure système.
