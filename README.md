<div align="center">

# MMD XR Stage

**A standalone WebGL + WebXR MMD showcase built for Meta Quest.**

[![React 19](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186-111111)](https://threejs.org/)
[![WebXR](https://img.shields.io/badge/WebXR-Quest-5b4bdb?logo=meta&logoColor=white)](https://immersiveweb.dev/)
[![Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-d22128)](./LICENSE)

[Live site](https://mmd-xr-stage.pages.dev) · [Roadmap](./docs/mmd-vr-showcase-roadmap.md) · [Loader maintenance](./docs/three-mmd-loader-maintenance.md) · [Deployment notes](./docs/deployment.md)

</div>

MMD XR Stage is a single-purpose VR showcase for user-provided MMD (MikuMikuDance) content: drop in PMX/PMD models, VMD motions, and audio on the prep page, then enter immersive VR on a Quest headset.

## Features

### Prep Page

- Drag in folders of models, motions, audio, and objects; slot them per asset-type limits.
- Quest quality presets (safe / balanced / clarity) plus per-axis overrides: frame rate, framebuffer scale, foveation, antialias, shadows, DPR.
- Live XR readiness probe: secure context, `navigator.xr` availability, and an advisory `immersive-vr` support check, surfaced before you enter.

### In VR

- In-headset HUD with quality controls, model transform, height adjustment, snap turning, and exposure/lighting looks.
- Meta Quest hand tracking with articulated hands, pinch-based HUD interaction, and hand-to-model physics collision.
- Optional controller collision, contact haptics, physics quality controls, and session-safe model disposal.
- WebXR MSAA on WebGL2 projection layers (three 0.186) via the antialias quality axis.

## Stack

| Area | Technology |
| --- | --- |
| Application | React 19, TypeScript, Vite |
| 3D and XR | Three.js 0.186, React Three Fiber, React Three XR |
| MMD | `@yohawing/three-mmd-loader@0.8.3` (patched), Bullet WASM |
| State | Zustand |
| Hosting | Cloudflare Pages |

## Quick Start

Requirements:

- Node.js `22.13.0` or newer
- pnpm `11.17.0`

```sh
pnpm install --frozen-lockfile
pnpm dev
```

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm test` | Run the Vitest suite once |
| `pnpm build` | Type-check and create the production build |
| `pnpm deploy` | Build and deploy `dist` to Cloudflare Pages |

## WebXR Requirements

- Immersive VR requires a browser and device supporting WebXR `immersive-vr`.
- Production XR must run from a secure HTTPS origin; `localhost` is allowed during development. The prep page reports an insecure context or a missing WebXR runtime before you attempt to enter.
- Hand tracking is requested as an optional WebXR capability at session creation. Its availability depends on the headset and browser; the in-headset HUD can enable or disable its visuals, interaction, and physics collision.
- Controller collision and haptics were built and validated against the Meta Quest Browser; other headsets are untested.
- Desktop browser tests cannot replace headset validation. Regression items: model scaling, cloth fall/contact, panel persistence, controller and hand collisions, contact counts, and haptics.

## Local Data

Preferences and session settings are stored locally via `localStorage`. Clearing site data resets them. Imported MMD models, motions, textures, and audio remain local to the browser; this repository ships no character or motion assets. Use only assets whose creator terms permit your intended use.

## Deployment

The production build is written to `dist` and deployed to the `mmd-xr-stage` Cloudflare Pages project (<https://mmd-xr-stage.pages.dev>) via `pnpm deploy`. See [docs/deployment.md](./docs/deployment.md) for deployment notes and wrangler caveats.

## Licensing

Licensed under the [Apache License 2.0](./LICENSE). Bullet runtime attribution lives in [docs/THIRD_PARTY_NOTICES.md](./docs/THIRD_PARTY_NOTICES.md).
