# Référence API

## Base URL

- Dev API: `http://127.0.0.1:8787`
- Prod mono-serveur: `http://127.0.0.1:4173`

## Endpoints principaux

### Auth

- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Public (sans session admin)

- `GET /api/health`
- `GET /api/settings`
- `GET /api/player/context`
- `GET /api/playlists`
- `GET /api/player/authorize`
- `GET /api/player/bootstrap`
- `GET /api/assets/:id/blob`
- `POST /api/player/enroll`
- `POST /api/player/heartbeat`
- `POST /api/player/command-ack`
- `POST /api/player/rotate-token`
- `POST /api/player/pair/start`
- `POST /api/screens/register`
- `POST /api/screens/heartbeat`
- `POST /api/screens/pair/claim`

> Note: `POST /api/screens/register` et `POST /api/screens/heartbeat` sont conservés pour compatibilité mais renvoient désormais `410` (découverte réseau retirée).

### Screens / Player

- `GET /api/screens`
- `POST /api/screens/register`
- `POST /api/screens/heartbeat`
- `POST /api/screens/pair/claim`
- `GET /api/player/authorize`
- `GET /api/player/bootstrap`
- `POST /api/player/enroll`
- `POST /api/player/heartbeat`
- `POST /api/player/command-ack`
- `POST /api/player/pair/start`
- `POST /api/player/rotate-token`
- `POST /api/screens/:screenId/command`
- `POST /api/screens/commands/bulk`
- `POST /api/screens/rotate-token/bulk`

### Monitoring / Alerts / Ops

- `GET /api/monitoring/fleet`
- `GET /api/alerts`
- `GET /api/alerts/config`
- `PUT /api/alerts/config`
- `POST /api/alerts/:alertId/ack`
- `POST /api/alerts/:alertId/silence`
- `GET /api/ops/sla`
- `GET /api/audit`
- `GET /api/storage/policy`
- `PUT /api/storage/policy`

## Flux recommandé (PIN / QR uniquement)

1. Le player appelle `POST /api/player/pair/start`.
2. Le player affiche le PIN + QR (vers `/screens?pin=XXXXXX`).
3. L’admin saisit/valide le PIN via `POST /api/screens/pair/claim`.
4. Le player devient autorisé (`GET /api/player/authorize`) puis envoie `POST /api/player/heartbeat`.

## Exemples d’API

### Démarrer le pairage PIN

`POST /api/player/pair/start`

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
  "expiresAt": "2026-03-09T15:45:00.000Z",
  "ip": "192.168.1.50"
}
```

### Valider un PIN côté admin

`POST /api/screens/pair/claim`

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
    "id": "screen-1773071212970",
    "deviceId": "rpi-01",
    "status": "online"
  }
}
```

### Heartbeat player (après pairage)

`POST /api/player/heartbeat`

Body:

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
    "version": "1.0.0"
  }
}
```

Réponse OK:

```json
{
  "ok": true,
  "status": "online",
  "command": {
    "command": "refresh",
    "issuedAt": "2026-03-09T12:00:00.000Z",
    "signature": "..."
  }
}
```

Réponse non pairé:

```json
{
  "ok": false,
  "error": "screen not paired"
}
```

### ACK de commande player

`POST /api/player/command-ack`

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

Réponse:

```json
{
  "ok": true
}
```

Notes:

- Le couple `deviceId` + `token` doit correspondre à l’écran pairé.
- Si une commande n’est jamais acquittée, le serveur la réessaie via `/api/player/heartbeat` jusqu’à `maxRetries`, puis la marque en échec (`timeout-no-ack`).

### Settings système (config + schéma DB)

`GET /api/settings`

Réponse:

```json
{
  "ok": true,
  "storage": "system",
  "schemaVersion": 2,
  "systemConfig": {}
}
```

### Storage Management

- `GET /api/storage/stats`
- `POST /api/storage/clear-cache`
- `GET /api/storage/policy`
- `PUT /api/storage/policy`

Exemple `GET /api/storage/stats`:

```json
{
  "totalAssets": 12,
  "totalSize": 15423012,
  "cacheSize": 1200000,
  "logsCount": 230,
  "logsSize": 46000,
  "dbEngine": "sqlite",
  "dbPath": ".../database/system.db",
  "policy": {
    "maxAssetBytes": 6442450944,
    "maxCacheBytes": 1073741824,
    "logsRetentionDays": 30,
    "autoPurge": true,
    "staleHeartbeatSeconds": 90
  }
}

### Fleet Monitoring

`GET /api/monitoring/fleet`

Réponse:

```json
{
  "ok": true,
  "summary": {
    "total": 4,
    "online": 3,
    "stale": 1,
    "pending": 0,
    "offline": 0
  },
  "items": [
    {
      "id": "screen-1",
      "name": "Accueil",
      "status": "online",
      "heartbeatAgeMs": 4200,
      "telemetry": {
        "cpuPercent": 21,
        "memoryPercent": 39,
        "temperatureC": 0,
        "diskUsedPercent": 58,
        "version": "1.0.0"
      }
    }
  ]
}
```

### Centre d’alertes

- `GET /api/alerts` : liste des alertes actives (offline/stale/température/stockage)
- `GET /api/alerts/config` : lecture des seuils
- `PUT /api/alerts/config` : mise à jour des seuils
- `POST /api/alerts/:alertId/ack` : passe une alerte en statut `ack`
- `POST /api/alerts/:alertId/silence` : silence une alerte (30 min par défaut)

Cycle de vie persistant: `new` → `ack` / `silenced` → `resolved`.

Exemple `PUT /api/alerts/config` body:

```json
{
  "config": {
    "offlineAfterSeconds": 240,
    "staleAfterSeconds": 120,
    "maxTemperatureC": 78,
    "maxStorageUsagePercent": 88,
    "maxHeartbeatLatencyMs": 30000
  }
}
```

### Actions groupées écrans

`POST /api/screens/commands/bulk`

Body:

```json
{
  "command": "refresh",
  "screenIds": ["screen-1", "screen-2"]
}
```

`POST /api/screens/rotate-token/bulk`

Body:

```json
{
  "screenIds": ["screen-1", "screen-2"]
}
```

### Ops / audit

- `GET /api/ops/sla` : disponibilité, incidents 24h, MTTR simplifié
- `GET /api/audit` : historique d’audit (filtres `type`, `actor`, `search`, `limit`)
```

### Contenu

- `GET /api/layouts`
- `POST /api/layouts`
- `GET /api/playlists`
- `POST /api/playlists`
- `GET /api/assets`
- `POST /api/assets`

## API générée automatiquement

La documentation API TypeDoc est publiée dans:

- `/docs/api/index.html`
