Créer une application web complète de Digital Signage Management System comparable aux fonctionnalités de Screenly et Anthias mais avec une architecture simplifiée :

backend Node.js + TypeScript

stockage JSON database

stockage fichiers local

dashboard admin complet

player écran kiosk

gestion de contenus et playlists

import calendrier iCal uniquement (pas Google API)

L’interface doit être professionnelle, moderne et minimaliste avec un design Glassmorphism Dark.

Thème UI

Créer un design system complet.

Couleurs

Background principal

#0f172a

Cartes glass

rgba(255,255,255,0.08)
backdrop-blur: 20px
border: 1px rgba(255,255,255,0.12)

Accent principal

#3b82f6

Accent secondaire

#22c55e

Warning

#f59e0b

Error

#ef4444

Texte

Primary : #e5e7eb
Secondary : #9ca3af

Effets visuels :

blur glassmorphism

ombre douce

animations fluides

transitions 200ms

coins arrondis 16px

Layout global

Dashboard admin avec layout :

Sidebar gauche
Topbar
Content principal
Panels glass

Sidebar :

Dashboard
Screens
Playlists
Assets
Calendar
Layouts
Widgets
Storage
Logs
Settings

Topbar :

Search
Notifications
User menu
Dark theme toggle
Architecture technique à générer

Créer la structure complète du projet :

/signage-system
   /server
   /dashboard
   /player
   /storage
       /assets
       /cache
       /screens
   /database
       db.json

Stack :

Backend

Node.js
Express
TypeScript

Frontend admin

React
Next.js
Tailwind

Player

HTML
TypeScript
WebSocket

Database

JSON database
auto save
file based
Schéma base JSON

Créer un fichier db.json.

Structure :

users
screens
playlists
playlistItems
assets
calendarSources
layouts
widgets
logs
settings

Exemple :

{
 "screens": [
  {
   "id": "screen-1",
   "name": "Salle réunion 1",
   "playlistId": "playlist-main",
   "status": "online",
   "lastSeen": ""
  }
 ],
 "assets": [
  {
   "id": "asset-1",
   "type": "image",
   "url": "/storage/assets/image.png"
  }
 ]
}
Fonctionnalités à implémenter

Créer toutes les fonctionnalités suivantes.

1 Dashboard Overview

Page principale affichant :

cards statistiques :

Screens online
Screens offline
Assets total
Playlists
Calendar events today

Graphiques :

activité écrans

utilisation contenu

Liste :

écrans récemment actifs

derniers logs

2 Gestion Screens

Page :

/admin/screens

Fonctions :

ajouter écran

générer screen token

assigner playlist

voir statut online/offline

voir IP

voir dernière activité

Card écran :

Nom
Localisation
Playlist
Status
Last heartbeat

Actions :

edit
restart
reload
delete
preview
3 Gestion Assets

Uploader :

images
videos
html widgets
pdf
web pages

Interface :

grid gallery glass.

Chaque asset :

preview
type
size
date
usage

Actions :

preview
edit
delete
assign to playlist

Stockage :

/storage/assets
4 Playlists

Créer une playlist.

Playlist builder drag and drop.

Items possibles :

image
video
webpage
calendar view
widget
html template

Options :

duration
transition
schedule
priority
5 Calendar

Import calendrier iCal.

Page :

/admin/calendar

Fonctions :

add ICS URL
sync calendar
assign rooms
filter events

Vues :

today
week
room view
6 Layout Designer

Créer layouts écran.

Interface builder :

drag zones
resize blocks

Blocks :

video zone
image zone
calendar
text
rss
clock
weather
webpage

Sauvegarder layout.

7 Widgets

Widgets disponibles :

clock
weather
rss feed
news ticker
custom html
markdown
calendar

Widgets configurables.

8 Screen Player

Créer une app player.

Fonctions :

connect with screen token
heartbeat 30s
fetch playlist
download assets
cache offline
rotate content
fullscreen kiosk

Rendu :

images
videos
calendar
web widgets
layouts

Fallback :

offline cache
9 Monitoring

Page monitoring.

Afficher :

map screens
status
uptime
heartbeat logs

Graphiques :

activity
errors
network latency
10 Storage Manager

Interface pour voir :

storage usage
assets
cache
logs

Nettoyage automatique.

11 Logs

Logs système :

screen activity
errors
uploads
calendar sync

Viewer logs.

12 Settings

Paramètres globaux.

timezone
storage limit
default duration
player refresh
heartbeat interval
Player UI (écran)

Créer une interface fullscreen minimaliste.

Exemple écran réunion :

┌──────────────────────────┐
│ Planning salles aujourd'hui │
├─────────────┬────────────┤
│ Salle A     │ Salle B    │
│ Meeting 9h  │ Libre      │
│ Dev 10h     │ Marketing  │
└─────────────┴────────────┘

Mode :

fullscreen
auto refresh
smooth transitions
Animations

Transitions :

fade
slide
zoom
crossfade

Durée :

300ms
Composants UI à générer

Créer composants :

GlassCard
GlassButton
GlassSidebar
StatCard
AssetCard
ScreenCard
PlaylistEditor
CalendarView
LayoutEditor
WidgetPanel
Résultat attendu

Générer :

design UI complet

composants React

structure backend Node TS

schéma JSON DB

player écran

dashboard admin complet