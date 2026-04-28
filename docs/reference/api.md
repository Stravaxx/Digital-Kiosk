# Référence API complète

Ce document couvre l'API Digital Kiosk de bout en bout, avec exemples de requêtes et réponses attendues.

## 1. Environnements et conventions

## Base URL

- Développement API: `http://127.0.0.1:8787`
- Développement panel (Vite): `http://127.0.0.1:4173`
- Déploiement unifié: selon reverse-proxy et mode d'exécution

## Format de réponse

La majorité des routes renvoient du JSON avec la convention:

- succès: `{ "ok": true, ... }`
- échec: `{ "ok": false, "error": "..." }`

## Authentification

Deux modes coexistent:

- Session admin (cookie/session interne)
- Clé API: header `X-API-Key: dk_live_...`

Exemple header:

```http
X-API-Key: dk_live_xxxxxxxxxxxxxxxxx
```

## Erreurs fréquentes

- `400` validation (body/query/params invalides)
- `401` token/session manquant ou expiré
- `403` permission insuffisante
- `404` ressource inconnue
- `503` maintenance mode actif

---

## 2. Santé et configuration système

### GET /api/health

Vérifie la santé basique backend.

```bash
curl -X GET http://127.0.0.1:8787/api/health
```

Réponse attendue:

```json
{
  "ok": true,
  "storage": "system"
}
```

### GET /api/settings

Retourne la configuration consolidée.

```bash
curl -X GET http://127.0.0.1:8787/api/settings
```

Exemple:

```json
{
  "ok": true,
  "storage": "system",
  "schemaVersion": 2,
  "iframeDomainWhitelist": ["youtube.com", "vimeo.com"],
  "systemConfig": {
    "timezone": "Europe/Paris"
  }
}
```

### GET /api/system/kv/:key

Lit une clé de configuration système.

```bash
curl -X GET http://127.0.0.1:8787/api/system/kv/ds.rooms
```

### PUT /api/system/kv/:key

Écrit/écrase une clé de configuration système.

```bash
curl -X PUT http://127.0.0.1:8787/api/system/kv/ds.rooms \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_live_xxx" \
  -d '{"value":[{"id":"room-1","name":"Salle 1"}]}'
```

Réponse typique:

```json
{
  "ok": true,
  "key": "ds.rooms"
}
```

---

## 3. Authentification et comptes admin

### POST /api/auth/bootstrap

Crée le premier administrateur.

```bash
curl -X POST http://127.0.0.1:8787/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPass01"}'
```

Réponses possibles:

- `201` créé
- `409` déjà initialisé

Exemple:

```json
{
  "ok": true,
  "username": "admin",
  "role": "admin"
}
```

### POST /api/auth/login

```bash
curl -X POST http://127.0.0.1:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPass01"}'
```

Exemple:

```json
{
  "ok": true,
  "username": "admin",
  "role": "admin"
}
```

### POST /api/auth/logout

```bash
curl -X POST http://127.0.0.1:8787/api/auth/logout
```

### GET /api/auth/session

Retourne la session courante.

```bash
curl -X GET http://127.0.0.1:8787/api/auth/session
```

### GET /api/auth/status

Statut d'auth global backend.

### Gestion utilisateurs/groupes/permissions

- `GET /api/auth/users`
- `POST /api/auth/users`
- `PUT /api/auth/users/:username`
- `DELETE /api/auth/users/:username`
- `GET /api/auth/groups`
- `POST /api/auth/groups`
- `PUT /api/auth/groups/:id`
- `DELETE /api/auth/groups/:id`
- `GET /api/auth/permissions`

Exemple création user:

```bash
curl -X POST http://127.0.0.1:8787/api/auth/users \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_live_xxx" \
  -d '{"username":"operator01","password":"StrongPass01","role":"operator"}'
```

---

## 4. Flux mobile connect (Flutter / desktop manager)

### POST /api/mobile/connect/init

Initie une demande d'approbation.

```bash
curl -X POST http://127.0.0.1:8787/api/mobile/connect/init \
  -H "Content-Type: application/json" \
  -d '{"appName":"Digital Kiosk Manager Flutter","platform":"flutter","callbackUrl":""}'
```

Exemple:

```json
{
  "ok": true,
  "requestId": "req_123",
  "state": "state_abc",
  "pollToken": "poll_456",
  "approvalUrl": "/mobile/connect/approve?requestId=req_123"
}
```

### GET /api/mobile/connect/status

```bash
curl -G http://127.0.0.1:8787/api/mobile/connect/status \
  --data-urlencode "requestId=req_123" \
  --data-urlencode "pollToken=poll_456"
```

Exemple pending:

```json
{
  "ok": true,
  "status": "pending"
}
```

Exemple approved:

```json
{
  "ok": true,
  "status": "approved",
  "approvalCode": "appr_789"
}
```

### POST /api/mobile/connect/exchange

```bash
curl -X POST http://127.0.0.1:8787/api/mobile/connect/exchange \
  -H "Content-Type: application/json" \
  -d '{"requestId":"req_123","pollToken":"poll_456","state":"state_abc","approvalCode":"appr_789"}'
```

Exemple:

```json
{
  "ok": true,
  "apiKey": "dk_live_xxx",
  "apiKeyId": "key_01",
  "scopes": ["panel.read", "panel.write"]
}
```

### GET /mobile/connect/approve

Page web d'approbation (navigateur admin).

### POST /api/mobile/connect/approve

Action approve/reject depuis formulaire admin.

### GET /api/mobile/connect/requests

Liste les demandes de connexion.

### GET /api/mobile/connect/auth

Informations d'auth côté flux mobile.

---

## 5. Contenu: layouts, playlists, assets, meetings

## Layouts

- `GET /api/layouts`
- `POST /api/layouts`
- `DELETE /api/layouts/:id`

Exemple création layout:

```bash
curl -X POST http://127.0.0.1:8787/api/layouts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_live_xxx" \
  -d '{"name":"Room Door","zones":[{"id":"main","type":"meeting"}]}'
```

## Playlists

- `GET /api/playlists`
- `POST /api/playlists`
- `DELETE /api/playlists/:id`

Exemple réponse GET:

```json
[
  {
    "id": "pl_001",
    "name": "Playlist accueil",
    "items": [
      {"type": "asset", "assetId": "as_1", "durationSec": 15}
    ]
  }
]
```

## Assets

- `GET /api/assets`
- `POST /api/assets` (multipart)
- `POST /api/assets/import` (import de fichier)
- `GET /api/assets/:id/blob` (stream binaire)
- `DELETE /api/assets/:id`

Exemple upload:

```bash
curl -X POST http://127.0.0.1:8787/api/assets \
  -H "X-API-Key: dk_live_xxx" \
  -F "files=@C:/media/welcome.jpg"
```

Réponse typique:

```json
{
  "ok": true,
  "count": 1,
  "assets": [
    {
      "id": "as_1",
      "name": "welcome.jpg",
      "mimeType": "image/jpeg"
    }
  ]
}
```

## Meetings

- `GET /api/meetings`
- `POST /api/meetings`
- `DELETE /api/meetings/:id`

Exemple création:

```bash
curl -X POST http://127.0.0.1:8787/api/meetings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_live_xxx" \
  -d '{"title":"Comité projet","roomId":"room-1","startAt":"2026-04-18T09:00:00.000Z","endAt":"2026-04-18T10:00:00.000Z"}'
```

---

## 6. Écrans et player

## Écrans admin

- `GET /api/screens`
- `POST /api/screens`
- `DELETE /api/screens/:id`
- `POST /api/screens/register`
- `POST /api/screens/heartbeat`
- `GET /api/screens/bootstrap`

## Pairing PIN

- `POST /api/player/pair/start`
- `POST /api/screens/pair/claim`

Exemple démarrage pairing:

```bash
curl -X POST http://127.0.0.1:8787/api/player/pair/start \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"rpi-01","token":"tok_abc123","devname":"Salle Accueil","os":"Raspberry Pi OS"}'
```

Exemple:

```json
{
  "ok": true,
  "pin": "123456",
  "expiresAt": "2026-04-18T12:30:00.000Z"
}
```

## Runtime player

- `GET /api/player/bootstrap`
- `GET /api/player/authorize`
- `POST /api/player/enroll`
- `POST /api/player/heartbeat`
- `POST /api/player/command-ack`
- `POST /api/player/rotate-token`

Exemple heartbeat:

```bash
curl -X POST http://127.0.0.1:8787/api/player/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId":"rpi-01",
    "token":"tok_abc123",
    "os":"Raspberry Pi OS",
    "telemetry":{
      "cpuPercent":22,
      "memoryPercent":41,
      "networkMbps":12.7,
      "networkInterface":"wlan0",
      "temperatureC":52,
      "diskUsedPercent":63,
      "version":"1.2.0"
    }
  }'
```

Réponse typique:

```json
{
  "ok": true,
  "status": "online",
  "command": null
}
```

Exemple avec commande en attente:

```json
{
  "ok": true,
  "status": "online",
  "command": {
    "id": "cmd_01",
    "command": "refresh",
    "issuedAt": "2026-04-18T09:00:00.000Z",
    "signature": "sha256...",
    "retries": 0,
    "maxRetries": 6
  }
}
```

## Commandes écran

- `POST /api/screens/:screenId/command`
- `POST /api/screens/commands/bulk`
- `POST /api/screens/rotate-token/bulk`

Exemple bulk command:

```bash
curl -X POST http://127.0.0.1:8787/api/screens/commands/bulk \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_live_xxx" \
  -d '{"screenIds":["screen-1","screen-2"],"command":"reload"}'
```

---

## 7. Monitoring, alertes, ops, audit

## Monitoring

- `GET /api/monitoring/connected-clients`
- `GET /api/monitoring/system-usage`
- `GET /api/monitoring/fleet`

Exemple system usage:

```json
{
  "ok": true,
  "cpuPercent": 13,
  "memoryPercent": 48,
  "network": {
    "selectedInterface": "Wi-Fi",
    "rxMbps": 4.2,
    "txMbps": 1.3
  }
}
```

## Alertes

- `GET /api/alerts/config`
- `PUT /api/alerts/config`
- `GET /api/alerts`
- `POST /api/alerts/:alertId/ack`
- `POST /api/alerts/:alertId/silence`

## Ops / audit / activité

- `GET /api/ops/sla`
- `GET /api/audit`
- `GET /api/activity`

---

## 8. Stockage et logs

## Logs

- `GET /api/logs`
- `POST /api/logs`
- `DELETE /api/logs`

Exemple lecture:

```bash
curl -G http://127.0.0.1:8787/api/logs --data-urlencode "limit=100"
```

## Stockage

- `GET /api/storage/stats`
- `GET /api/storage/policy`
- `PUT /api/storage/policy`
- `POST /api/storage/clear-cache`

Exemple stats:

```json
{
  "ok": true,
  "totalBytes": 128000000000,
  "usedBytes": 64000000000,
  "assetsBytes": 42000000000,
  "cacheBytes": 8000000000
}
```

---

## 9. Update et maintenance

## Endpoints

- `GET /api/system/update/status`
- `GET /api/system/update/state`
- `POST /api/system/update/check`
- `POST /api/system/update/apply`
- `POST /api/system/update/execute`
- `GET /api/system/maintenance/status`
- `POST /api/system/maintenance/toggle`

Exemple toggle maintenance:

```bash
curl -X POST http://127.0.0.1:8787/api/system/maintenance/toggle \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dk_live_xxx" \
  -d '{"enabled":true,"reason":"system-update"}'
```

Exemple état update:

```json
{
  "ok": true,
  "isRunning": true,
  "currentStep": "verify-api",
  "progress": 72,
  "workerStatus": "running"
}
```

---

## 10. Compatibilité et endpoints utilitaires

- `GET /api/system/sync-stream`: retiré (SSE), remplacer par WebSocket.
- `GET /api/downloads`: informations de téléchargement.

### WebSocket système

Canal de synchronisation:

- `ws://<host>:<port>/ws/system-sync`

Message serveur typique:

```json
{
  "type": "system-usage",
  "payload": {
    "cpuPercent": 18,
    "memoryPercent": 47,
    "network": {
      "selectedInterface": "Wi-Fi",
      "rxMbps": 3.9,
      "txMbps": 0.8
    }
  }
}
```

---

## 11. Bonnes pratiques d'intégration API

- Toujours valider les codes HTTP avant de parser la réponse.
- Prévoir gestion explicite de `401/403/503` dans les clients.
- Implémenter retry exponentiel sur endpoints de polling (mobile connect, update state).
- Journaliser côté client les correlationId si disponibles.
- Pour routes critiques (commandes écrans), implémenter idempotence côté client.

---

## 12. Checklist de test API (recommandée)

- Auth bootstrap/login/session/logout
- Mobile connect init/status/exchange/approve
- Pairing player start/claim/authorize/heartbeat/ack
- CRUD contenu layouts/playlists/assets/meetings
- Monitoring/alerts/ops/audit
- Update/maintenance
- Storage/logs

Commande rapide:

```bash
npm run api:verify
```

Pour tests contractuels complets, ajouter une suite d'intégration dédiée qui vérifie les payloads documentés ci-dessus.
