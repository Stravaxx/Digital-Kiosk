# Manuel utilisateur — Storage

## Objectif

Suivre l’occupation disque et appliquer la politique de stockage.

## Données affichées

- usage total,
- répartition assets/cache/logs,
- capacité disque système (ou fallback 20 Go).

## Actions

- nettoyer le cache,
- ajuster la politique storage,
- contrôler la croissance des logs.

## Bonnes pratiques

- surveiller le pourcentage disque,
- limiter la taille des médias,
- planifier des purges régulières.

## Erreurs fréquentes

- **Quota dépassé**: imports refusés.
- **Disk high usage**: lancer nettoyage + réduire assets lourds.
