# Manuel utilisateur — Dashboard

## Objectif

Le Dashboard donne une vue rapide de l’état global du système.

## Ce que vous voyez

- compteurs principaux (écrans online/offline, assets, salles),
- activité récente,
- réunions à venir,
- statut des écrans.

## Actions recommandées

1. Vérifier d’abord les écrans offline/pending.
2. Contrôler les réunions à venir pour détecter les conflits de planning.
3. Ouvrir Fleet/Alerts si une anomalie apparaît.

## Bonnes pratiques

- rafraîchir la page après un déploiement massif,
- traiter les états `pending` rapidement,
- utiliser Fleet pour les détails de télémétrie.

## Erreurs fréquentes

- **Données vides**: API inaccessible ou session expirée.
- **Compteurs incohérents**: latence entre heartbeat player et affichage panel.
