# Manuel utilisateur — Fleet

## Objectif

Superviser l’état de tous les players déployés.

## Ce que vous voyez

- résumé global (online/stale/offline/pending),
- détail par écran,
- télémétrie (CPU, RAM, disque, version).

## Actions recommandées

- traiter immédiatement les écrans `stale`/`offline`,
- relancer commande `refresh` si nécessaire,
- corréler avec Alerts.

## Erreurs fréquentes

- **Stale persistant**: heartbeat non reçu (réseau/appareil).
- **Valeurs télémétrie nulles**: player ancien ou permissions manquantes.
