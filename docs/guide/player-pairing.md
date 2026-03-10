# Player & Pairing PIN

## Enrôlement

Le player génère un PIN de liaison temporaire.

Le token player est:

- sauvegardé localement,
- rechargé au redémarrage,
- gardé en mémoire pendant l’exécution.

## Liaison via QR code

Le QR code redirige vers:

- `/screens?pin=<PIN>`

Le champ PIN est automatiquement prérempli dans l’interface admin.

## Liaison manuelle

Dans l’onglet Screens:

- saisir le PIN à 6 chiffres,
- cliquer `Lier appareil`.

Aucune saisie IP n’est requise.

## Important

La découverte automatique des players sur le réseau local est désactivée.

Le seul mode de liaison supporté est:

- PIN (saisie manuelle),
- ou QR Code (pré-remplit le PIN côté admin).
