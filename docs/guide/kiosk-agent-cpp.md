# Agent Kiosk C++ (compromis recommandé)

## Pourquoi ce choix

Le compromis retenu est:

- **Agent natif C++** pour la fiabilité système (service, watchdog, offline)
- **Renderer HTML existant** pour conserver le frontend `/player`

Ce modèle évite de réécrire l’UI player tout en gagnant la robustesse nécessaire en production.

## Architecture

- Agent C++ (`kiosk-agent-cpp/`)
  - service Linux/Windows
  - sync API backend
  - cache offline last-known-good
  - scheduler local
  - watchdog renderer
- Renderer
  - Linux: Chromium/WPE en mode kiosk
  - Windows: WebView2/Edge kiosk

## Arborescence

- `kiosk-agent-cpp/CMakeLists.txt`
- `kiosk-agent-cpp/src/main.cpp`
- `kiosk-agent-cpp/src/AgentApp.cpp`
- `kiosk-agent-cpp/include/agent/AgentApp.hpp`
- `kiosk-agent-cpp/config/agent-config.example.json`
- `kiosk-agent-cpp/scripts/kiosk-agent.service`

## Build rapide

```bash
cmake -S kiosk-agent-cpp -B kiosk-agent-cpp/build
cmake --build kiosk-agent-cpp/build --config Release
```

## Intégration API

L’agent cible les endpoints:

- `GET /api/player/authorize`
- `GET /api/player/bootstrap`
- `POST /api/player/heartbeat`
- `POST /api/player/rotate-token`
- `GET /api/monitoring/fleet`

## Roadmap complète

Voir la checklist exhaustive dans `TASKS.md` (backend, panel, player, agent, devops, docs).
