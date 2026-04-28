# Run Modes

## FR

### Web development

```bash
npm run dev
```

- API: `http://127.0.0.1:8787`
- Admin: `http://127.0.0.1:4173`
- Player: `http://127.0.0.1:4173/player?instance=1`

### Web production-like runtime

```bash
npm run build
npm run prod
```

### Electron admin (dev)

```bash
npm run desktop
```

### Electron admin (renderer build + local run)

```bash
npm run desktop:win
```

### Electron player (fullscreen)

```bash
npm run desktop:player
```

### Windows packaging

- `npm run package:admin:win`
- `npm run package:player:win`

## EN

The project currently supports three runtime families:

- web runtime for development and Node.js deployments,
- Electron admin for local Windows supervision,
- Electron player for dedicated fullscreen signage playback.

Use `npm run dev`, `npm run desktop`, or `npm run desktop:player` depending on the surface you need to validate.
