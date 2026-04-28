# Application Flutter (Windows, macOS, Linux, Android, iOS)

## Objectif

Piloter Digital Kiosk depuis un client Flutter multi-plateforme, sans dépendre en permanence du panel web.

## Couverture fonctionnelle actuelle

- Connexion sécurisée via flux d'approbation admin.
- Gestion multi-serveurs (serveur actif, serveur principal, édition/suppression).
- Dashboard opérationnel (écrans, réunions, assets, logs, monitoring, update).
- Thème dynamique (clair/sombre/système + accent couleur).
- Langue UI FR/EN avec bascule instantanée.
- Écran About avec version, mainteneurs, métriques GitHub, bouton bibliothèques.

## Architecture Flutter

- Dossier: `flutter_kiosk_manager/`
- UI: Material Design 3 (`useMaterial3: true`)
- État persistant local: `SharedPreferences`
- Contrôleurs globaux:
	- thème: `AppThemeController`
	- locale: `AppLocaleController`

## Flux de connexion sécurisé

1. L'utilisateur saisit l'URL serveur.
2. Appel `POST /api/mobile/connect/init`.
3. Ouverture navigateur sur `/mobile/connect/approve?...`.
4. Validation admin (approve/reject).
5. Polling de statut puis échange via `POST /api/mobile/connect/exchange`.
6. Récupération clé API `dk_live_...` et persistance locale.

## Internationalisation FR/EN

- Basée sur `Locale` globale dans `MaterialApp`.
- Délégués Flutter:
	- `GlobalMaterialLocalizations`
	- `GlobalWidgetsLocalizations`
	- `GlobalCupertinoLocalizations`
- Changement de langue sans redémarrage de l'application.

## Écran About

L'écran About expose:

- nom de l'application,
- version (`pubspec.yaml`),
- mainteneurs,
- lien GitHub,
- métriques GitHub (stars, forks, likes/watchers, vues),
- bouton de consultation des librairies (license page Flutter).

## Multi-sites

Le client stocke plusieurs profils serveur et permet:

- serveur actif,
- serveur principal,
- reprise automatique sur serveur crédentiel valide.

## Sécurité

- Clé API dédiée par connexion approuvée.
- Validation explicite admin obligatoire.
- Endpoints de maintenance/update compatibles (`/api/system/*`).
- Vérification API critique possible via `npm run api:verify`.

## Build et exécution

### Lancer en dev

```bash
cd "Digital Kiosk Manager"
flutter run -d android
```

Pour Windows, n utilisez pas le `flutter run -d windows` direct sur cette machine si Android Studio/Flutter pointe le projet sur D: alors que le cache Pub reste sur C:. Flutter echoue alors pendant la creation des symlinks plugin avec `ERROR_INVALID_FUNCTION`.

Si Android Studio affiche `Launching lib/main.dart on Windows in debug mode`, alors le target selectionne est Windows et non l appareil Android.

Utilisez le contournement fourni depuis la racine du repo :

```powershell
npm run flutter:run:windows:workaround
```

Ou depuis le dossier Flutter ouvert dans Android Studio :

```bat
run-windows-workaround.cmd
```

### Build Windows (environnement NTFS recommandé)

```powershell
npm run flutter:build:windows:workaround
```

Ce script est recommandé sur Windows quand la création de symlinks Flutter échoue sur certains disques ou contextes de sécurité.
