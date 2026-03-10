# Kiosk Agent C++

Agent système cross-platform (Linux/Windows) pour piloter le renderer HTML existant (`/player`) en mode kiosk.

## Objectifs

- Démarrage service natif (`systemd` / Windows Service)
- Watchdog renderer (auto-heal)
- Sync API backend (authorize/bootstrap/heartbeat)
- Cache offline last-known-good
- Scheduler local en mode dégradé
- Télémétrie enrichie

## Build local

```bash
cmake -S . -B build
cmake --build build --config Release
```

Depuis `kiosk-agent-cpp`, il n'est pas nécessaire de faire `cd build` avant ces commandes.

Binaire attendu:

- Linux: `build/kiosk-agent`
- Windows: `build/Release/kiosk-agent.exe`

## Lancement

```bash
./build/kiosk-agent config/agent-config.example.json
```

Sous Windows:

```powershell
.\build\Release\kiosk-agent.exe .\config\agent-config.example.json
```

Le lancement renderer Windows utilise maintenant une stratégie de fallback:

1. commande configurée (`renderer.windows.command`)
2. `msedge.exe --kiosk ...`
3. `chrome.exe --kiosk ...`
4. navigateur système via `explorer.exe <url>`

Cela évite le blocage si WebView/Edge kiosk ne s’affiche pas.

## Note Windows (message `pwsh.exe`)

Sur certaines machines, MSBuild peut afficher:

- `'pwsh.exe' n'est pas reconnu ...`

Si le build continue et que `build/Release/kiosk-agent.exe` est généré, ce message est non bloquant (fallback vers `powershell.exe`).

## Linux (vérification rapide)

Le lancement renderer Linux tente:

1. commande configurée (`renderer.linux.command`)
2. `chromium-browser`
3. `chromium`
4. `cog` (WPE)
5. `xdg-open`

Vérifications recommandées sur la machine Linux cible:

```bash
which chromium-browser || which chromium || which cog
./build/kiosk-agent config/agent-config.example.json
```

Le renderer est considéré OK si une fenêtre kiosk (ou navigateur fallback) s’ouvre sur `/player`.

## Intégration backend existant

Le client consomme les endpoints déjà présents dans le projet:

- `GET /api/player/authorize`
- `GET /api/player/bootstrap`
- `POST /api/player/heartbeat`
- `POST /api/player/rotate-token`
- `GET /api/monitoring/fleet`

## Étapes suivantes

Consulter `../TASKS.md` pour la checklist complète backend/panel/player/agent.
