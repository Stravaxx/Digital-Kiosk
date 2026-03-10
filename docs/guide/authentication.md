# Authentification

## Admin

L’admin utilise une authentification par token Bearer.

- Login via `/api/auth/login`
- Session expirée après inactivité (15–20 min)
- Logout via `/api/auth/logout`

## Player

Le player ne nécessite pas de session admin pour fonctionner.

Routes player publiques:

- `/api/player/*`
- `/api/player/context`
- `/api/screens/bootstrap`
- `/api/screens/pair/claim`
- `/api/playlists` (GET)

Routes legacy retirées (renvoient `410`):

- `/api/screens/register`
- `/api/screens/heartbeat`
