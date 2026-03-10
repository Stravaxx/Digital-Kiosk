# Database Schema Documentation (v2)

## Overview

Le système persiste désormais une base JSON normalisée avec migration automatique côté serveur.

Structure racine:

```json
{
  "schemaVersion": 2,
  "collections": {
    "screens": [],
    "playerPairings": [],
    "screenGroups": [],
    "rooms": [],
    "events": [],
    "layouts": [],
    "layers": [],
    "playlists": [],
    "logs": []
  },
  "users": [],
  "config": {},
  "assets": [],
  "kv": {}
}
```

## Root Fields

### schemaVersion

Version du schéma persisté (`2`).

### collections

Conteneur principal des données métier.

### users

Utilisateurs admin normalisés.

### config

Configuration système globale.

### assets

Métadonnées des fichiers stockés dans `storage/assets`.

### kv

Miroir de compatibilité pour les clés legacy (`ds.*`).

## Collections

### screens

```json
{
  "id": "screen-...",
  "deviceId": "rpi-01",
  "name": "Salle A",
  "hostname": "rpi-salle-a",
  "ip": "192.168.1.50",
  "resolution": "1920x1080",
  "os": "Raspberry Pi OS",
  "status": "pending | online | offline",
  "roomIds": ["room-1"],
  "groupId": "group-1",
  "theme": {
    "mode": "inherit-group | light | dark | scheduled",
    "primaryColor": "#3b82f6",
    "lightStart": "07:00",
    "darkStart": "19:00"
  },
  "deviceToken": "tok_...",
  "lastHeartbeat": "ISO date",
  "layoutId": "layout-...",
  "pendingCommand": null
}
```

### playerPairings

```json
{
  "pin": "123456",
  "token": "tok_...",
  "deviceId": "rpi-01",
  "devname": "Salle A",
  "os": "Raspberry Pi OS",
  "ip": "192.168.1.50",
  "createdAt": "ISO date",
  "lastSeenAt": "ISO date",
  "expiresAt": "ISO date"
}
```

### rooms

```json
{
  "id": "room-1",
  "name": "Salle A",
  "number": "A101",
  "location": "Niveau 1",
  "capacity": 12,
  "status": "free | occupied | starting-soon"
}
```

### events

```json
{
  "id": "event-1",
  "title": "Comité projet",
  "status": "confirmed | cancelled",
  "startAt": "ISO date",
  "endAt": "ISO date",
  "roomId": "room-1",
  "roomNumber": "A101",
  "facilitators": ["Alice"],
  "maxParticipants": 10,
  "recurrence": {
    "frequency": "none | daily | weekly | monthly | yearly",
    "interval": 1,
    "daysOfWeek": [1, 2],
    "monthsOfYear": [1, 6],
    "until": "ISO date",
    "exceptions": ["2026-03-09"]
  },
  "updatedAt": "ISO date"
}
```

### layouts

```json
{
  "id": "layout-1",
  "name": "Standard 2 zones",
  "mode": "standard | room-door-display | room-status-board",
  "displayTemplate": "classic | low-vision",
  "resolution": "1920x1080",
  "headerText": "Bienvenue",
  "footerText": "Informations",
  "footerLogos": ["asset-image:asset-1"],
  "zones": []
}
```

### layers

Alias de `layouts` (maintenu pour cohérence métier et compatibilité documentaire).

### playlists

```json
{
  "id": "playlist-1",
  "name": "Playlist accueil",
  "items": []
}
```

### logs

```json
{
  "id": "log-1",
  "type": "system | screen | error | upload | sync | auth | player",
  "level": "info | warning | error",
  "message": "Player heartbeat",
  "source": "api.player.heartbeat",
  "timestamp": "ISO date",
  "details": {}
}
```

## Users

```json
{
  "username": "admin",
  "passwordHash": "...",
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "lastLoginAt": "ISO date",
  "passwordAlgo": "scrypt"
}
```

## Config

```json
{
  "timezone": "Europe/Paris",
  "dateFormat": "DD/MM/YYYY",
  "defaultContentDurationSec": 10,
  "playerRefreshIntervalMin": 60,
  "heartbeatIntervalSec": 30,
  "transitionEffect": "Fade",
  "transitionDurationMs": 300,
  "maximumStorageGb": 100,
  "cacheLimitGb": 10
}
```

## Pairing Policy

- Découverte réseau retirée.
- Liaison uniquement via PIN/QR:
  - `POST /api/player/pair/start`
  - `POST /api/screens/pair/claim`
- Heartbeat accepté uniquement pour un écran déjà pairé (`POST /api/player/heartbeat`).
