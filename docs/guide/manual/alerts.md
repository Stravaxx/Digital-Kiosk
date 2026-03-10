# Manuel utilisateur — Alerts

## Objectif

Traiter les alertes opérationnelles du parc.

## Cycle de vie

- `new` → `ack` ou `silenced` → `resolved`.

## Actions

- accuser réception (`ack`),
- silence temporaire (`silence`),
- suivi jusqu’à résolution.

## Bonnes pratiques

- ack rapidement les alertes prises en charge,
- éviter les silences trop longs,
- conserver une trace dans les procédures internes.

## Erreurs fréquentes

- **Alerte récurrente**: cause racine non corrigée.
- **Trop d’alertes**: seuils à recalibrer dans Settings/Config.
