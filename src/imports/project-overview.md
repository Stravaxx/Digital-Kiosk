1. Système Device / Raspberry Pi

Fonctionnalités nécessaires pour gérer des écrans réels.

Auto-provisioning

enregistrement automatique des écrans (/api/screens/register)

génération deviceToken

état initial pending

Heartbeat

endpoint /api/screens/heartbeat

détection offline > 60s

stockage lastSeen

Commandes remote

WebSocket commandes :

reload content

reboot device

refresh layout

clear cache

restart player

Infos device collectées
deviceId
hostname
ip
resolution
os
playerVersion
uptime
lastHeartbeat
Mode kiosk Raspberry Pi

Chromium kiosk

autostart systemd

watchdog redémarrage player

2. Layout Engine (correction majeure)

Le moteur de layout doit être stable et flexible.

Support multi-zones
zones:
- header
- main
- sidebar
- footer
Layout responsive

calcul dynamique taille écran

ratio correct

support portrait / paysage

Editor visuel

Fonctions :

drag zones

resize

grid snapping

preview écran

export JSON layout

Layout preview live

Simule contenu réel dans le dashboard.

3. Template System (affichage salles)

Important pour ton cas d’usage.

Templates à fournir

Meeting Room Today
Meeting Room Weekly
Door Display
Room Status Board
Corporate Dashboard
Mixed Media

Exemple template
Header
Current Meeting
Next Meeting
Today's Schedule
Media Zone
Paramètres template
roomId
calendarSource
displayMode
timeFormat
language
4. Calendar Engine

Système central pour l'affichage des réunions.

Sources supportées

iCal URL

JSON import

événements manuels

Synchronisation

cron job :

fetch every 5 minutes
Normalisation événements
id
title
start
end
room
organizer
location
Modes d'affichage

agenda jour

agenda semaine

timeline

meeting current highlight

5. Rooms Management

Nouveau module admin.

Entité Room
roomId
name
location
color
calendarSource
screenId
capacity
Fonctions admin

créer salle

assigner écran

assigner calendrier

assigner template

6. Playlist Engine avancé

Plus flexible que la version actuelle.

Types de contenu

image

video

HTML widget

calendar

iframe

RSS

text widget

weather widget

Zone targeting

Chaque contenu peut cibler une zone.

zoneId
duration
priority
7. Scheduling Engine

Système de programmation d’affichage.

paramètres supportés
startDate
endDate
daysOfWeek
timeRange
priority
cas d’usage

affichage :

publicité journée

meetings semaine

messages urgents

8. Offline Mode robuste

Crucial pour Raspberry Pi.

cache local

player stocke :

assets
layouts
playlists
calendar data
stockage
/player/cache
fallback

si serveur inaccessible :

playback cached content
9. Monitoring & Observability

Ajout d’un système de supervision.

dashboard

afficher :

écrans online

écrans offline

contenu actuel

CPU device

uptime

logs

stockage :

/storage/logs

logs :

player errors

websocket events

calendar sync

10. Asset Management amélioré

Gestion avancée des médias.

support

images

vidéos

SVG

HTML widgets

features

upload

thumbnails

tags

replace

preview

11. Security

Sécurisation de la plateforme.

authentification

login admin

JWT

API protection

middleware auth

player auth
deviceToken
12. WebSocket Infrastructure

Pour updates temps réel.

channels
player
admin
monitoring
événements
screen_update
playlist_update
layout_update
calendar_update
13. Performance optimisation

Important pour Raspberry Pi.

optimisations

lazy loading assets

preloading vidéos

GPU video decode

throttling animations

asset compression

14. UI/UX professionnel

Améliorations du dashboard.

design

Glassmorphism dark

composants

screen status cards

meeting cards

timeline agenda

layout editor

playlist editor

15. API complète

Endpoints nécessaires.

Screens
POST /screens/register
POST /screens/heartbeat
GET /screens
PATCH /screens/:id
Rooms
GET /rooms
POST /rooms
PATCH /rooms/:id
Layouts
GET /layouts
POST /layouts
Playlists
GET /playlists
POST /playlists
Calendar
GET /calendar/events
POST /calendar/source
16. Structure finale recommandée
project/

server/
api/
services/
calendar/
screens/
playlists/
layouts/
templates/

client-admin/
components/
pages/
editor/

player/
renderer/
cache/
ws/

storage/
assets/
cache/
logs/

db/
screens.json
rooms.json
layouts.json
playlists.json
assets.json
events.json