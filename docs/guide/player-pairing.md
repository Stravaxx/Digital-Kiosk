# Player & Pairing

## FR

### Enrôlement

Le player génère une identité durable composée d’un `deviceId`, d’un nom d’appareil et d’un token. Cette identité est conservée via:

- `localStorage`,
- IndexedDB / système KV si disponible,
- stockage Electron dédié pour les shells Windows.

### Pairing PIN

1. Le player appelle `/api/player/pair/start`.
2. Le backend renvoie un PIN temporaire à 6 chiffres.
3. L’admin revendique ce PIN dans l’onglet Screens.
4. Le player devient autorisé et passe en mode affichage.

### QR code

Le QR code redirige vers `/screens?pin=<PIN>` pour pré-remplir le champ dans le panel admin.

### Ce qui a changé

- la découverte réseau automatique n’est plus utilisée,
- le flow de pairing repose sur PIN ou QR code,
- le player Electron Windows recharge désormais correctement son token au redémarrage.

## EN

The player now keeps a durable identity made of `deviceId`, device name and token. That identity is restored from web storage and, on Windows Electron, from a dedicated local file store.

Pairing is PIN-based:

1. the player requests a temporary PIN,
2. an admin claims it in Screens,
3. the backend authorizes the player,
4. the player receives its display context.
