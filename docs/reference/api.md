# Référence API

## Base URL

- Dev API: `http://127.0.0.1:8787`
- Prod unifiée: `http://127.0.0.1:4173`
- Selon mode de déploiement, le panel et l’API peuvent être séparés.

## Authentification

### Routes publiques (sans session admin)

- `GET /api/health`
- `GET /api/settings`
- `GET /api/player/context`
- `GET /api/playlists`
- `GET /api/player/bootstrap`
- `GET /api/player/authorize`
- `POST /api/player/pair/start`
- `POST /api/player/enroll`
- `POST /api/player/heartbeat`
- `POST /api/player/command-ack`
- `POST /api/player/rotate-token`
- `POST /api/screens/pair/claim`
- `GET /api/assets/:id/blob`

### Routes admin (session requise)

- Auth users/session
- Layouts/playlists/assets CRUD
- Screens command/bulk
- Monitoring/alerts/ops
- Storage/system KV

Erreurs auth fréquentes:

- `401 missing token`
- `401 session expired`

## Endpoints par domaine

## Santé / configuration

### `GET /api/health`

Réponse:

```json
{
  "ok": true,
  "storage": "system"
}
```

### `GET /api/settings`

Réponse (extrait):

```json
{
  "ok": true,
  "storage": "system",
  "schemaVersion": 2,
  "iframeDomainWhitelist": ["youtube.com"],
  "systemConfig": {}
}
```

## Auth admin

### `POST /api/auth/bootstrap`

Crée le premier compte admin.

Body:

```json
{
  "username": "admin",
  "password": "StrongPassword123"
}
```

Codes:

- `201` créé
- `400` validation
- `409` déjà configuré

### `POST /api/auth/login`

Body:

```json
{
  "username": "admin",
  "password": "StrongPassword123"
}
```

Réponse:

```json
{
  "ok": true,
  "username": "admin",
  "role": "admin"
}
```

### `POST /api/auth/logout`

Invalide la session courante.

### `GET /api/auth/session`

Retourne les informations de session courante.

## Pairing player

## Flux recommandé

1. `POST /api/player/pair/start`
2. Affichage PIN/QR sur le player
3. `POST /api/screens/pair/claim`
4. `GET /api/player/authorize`
5. `POST /api/player/heartbeat`

### `POST /api/player/pair/start`

Body:

```json
{
  "deviceId": "rpi-01",
  "token": "tok_abc123",
  "devname": "Salle-Accueil",
  "os": "Raspberry Pi OS",
  "clientIp": "192.168.1.50"
}
```

Réponse:

```json
{
  "ok": true,
  "pin": "123456",
  "expiresAt": "2026-03-09T15:45:00.000Z"
}
```

### `POST /api/screens/pair/claim`

Body:

```json
{
  "pin": "123456"
}
```

Réponse:

```json
{
  "ok": true,
  "screen": {
    "id": "screen-1",
    "status": "online"
  }
}
```

Erreurs:

- `400` PIN manquant/format invalide
- `404` PIN inconnu ou expiré

## Player runtime

### `GET /api/player/authorize`

Query:

- `deviceId`
- `token`

Réponse:

```json
{
  "authorized": true
}
```

### `GET /api/player/bootstrap`

Renvoie écran + layout assignés.

### `POST /api/player/enroll`

Enrôlement initial d’un player.

### `POST /api/player/heartbeat`

Body (extrait):

```json
{
  "deviceId": "rpi-01",
  "token": "tok_abc123",
  "os": "Raspberry Pi OS",
  "clientIp": "192.168.1.50",
  "telemetry": {
    "cpuPercent": 22,
    "memoryPercent": 41,
    "temperatureC": 0,
    "diskUsedPercent": 57,
    "heartbeatLatencyMs": 152,
    "version": "1.1.0"
  }
}
```

Réponse typique:

```json
{
  "ok": true,
  "status": "online",
  "command": null
}
```

### `POST /api/player/command-ack`

Body:

```json
{
  "deviceId": "rpi-01",
  "token": "tok_abc123",
  "commandId": "cmd_123",
  "status": "done",
  "error": ""
}
```

## Contenu (admin)

### Layouts

- `GET /api/layouts`
- `POST /api/layouts`
- `DELETE /api/layouts/:id`

### Playlists

- `GET /api/playlists`
- `POST /api/playlists`
- `DELETE /api/playlists/:id`

### Assets

- `GET /api/assets`
- `POST /api/assets` (multipart)
- `POST /api/assets/import`
- `GET /api/assets/:id/blob`
- `DELETE /api/assets/:id`

## Screens / commandes

- `GET /api/screens`
- `POST /api/screens/:screenId/command`
- `POST /api/screens/commands/bulk`
- `POST /api/screens/rotate-token/bulk`
- `POST /api/player/rotate-token`

Exemple bulk command:

```json
{
  "command": "refresh",
  "screenIds": ["screen-1", "screen-2"]
}
```

## Monitoring / alertes / ops

- `GET /api/monitoring/fleet`
- `GET /api/alerts`
- `GET /api/alerts/config`
- `PUT /api/alerts/config`
- `POST /api/alerts/:alertId/ack`
- `POST /api/alerts/:alertId/silence`
- `GET /api/ops/sla`
- `GET /api/audit`

## Stockage / système

- `GET /api/storage/stats`
- `POST /api/storage/clear-cache`
- `GET /api/storage/policy`
- `PUT /api/storage/policy`
- `GET /api/system/kv/:key`
- `PUT /api/system/kv/:key`

## Endpoints legacy

Les endpoints suivants sont conservés pour compatibilité mais ne doivent plus être utilisés:

- `POST /api/screens/register` → `410`
- `POST /api/screens/heartbeat` → `410`

## Erreurs courantes

| Code | Cas typique | Action recommandée |
|---|---|---|
| 400 | Payload invalide | Vérifier champs requis et formats |
| 401 | Token absent/expiré | Reconnexion admin / vérifier token player |
| 403 | Route non autorisée selon `SERVER_MODE` | Vérifier mode serveur et route appelée |
| 404 | Ressource introuvable | Vérifier ID/PIN et expiration |
| 409 | Conflit métier | Vérifier état existant avant création |
| 410 | Endpoint retiré (legacy) | Migrer vers route moderne |
| 500 | Erreur interne | Consulter logs serveur et audit |

## Exemples d’usages possibles

- Pairing PIN/QR en environnement kiosque.
- Rotation massive de token après incident sécurité.
- Commande `refresh` groupée sur un étage complet.
- Politique storage plus stricte en sites à disque limité.
- Monitoring centralisé avec traitement d’alertes `ack/silence`.

## Documentation API générée

- TypeDoc front: `/docs/api/index.html`
