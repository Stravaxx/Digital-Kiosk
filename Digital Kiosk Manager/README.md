# Digital Kiosk Manager (Flutter)

Application Flutter Material 3 multi-plateforme:

- Windows
- macOS
- Linux
- Android
- iOS

## Objectif

Piloter Digital Kiosk sans interface web principale, avec un flux de connexion style Nextcloud:

1. Saisie URL serveur.
2. Demande d approbation mobile (`/api/mobile/connect/init`).
3. Redirection navigateur vers page d approbation admin (`/mobile/connect/approve`).
4. Validation admin, callback et echange en cle API (`/api/mobile/connect/exchange`).

## Lancer

```bash
cd "Digital Kiosk Manager"
flutter pub get
flutter run -d windows
```

Sur cette machine, le target Windows ne doit pas etre lance directement depuis le bouton Run/Debug d Android Studio quand le projet est sur D: et le cache Pub sur C:, sinon Flutter echoue pendant la creation des symlinks plugin (`ERROR_INVALID_FUNCTION`).

Si le log Android Studio affiche `Launching lib/main.dart on Windows in debug mode`, alors le target actif est Windows, pas votre appareil Android.

Utiliser a la place le lanceur local suivant depuis le terminal integre du projet Flutter :

```bat
run-windows-workaround.cmd
```

Depuis la racine du repo, le raccourci equivalent est :

```powershell
npm run flutter:run:windows:workaround
```

Exemples:

```bash
flutter run -d linux
flutter run -d android
flutter run -d ios
```

## Notes

- Les credentials sont stockes localement via `shared_preferences`.
- Les appels admin utilisent `X-API-Key`.
- Le serveur doit exposer les endpoints mobile connect ajoutés dans `server.cjs`.
