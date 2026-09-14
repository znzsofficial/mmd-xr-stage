<div align="center">

# MMD XR Stage

**A standalone WebGL + WebXR MMD showcase built for Meta Quest.**

[![React 19](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186-111111)](https://threejs.org/)
[![WebXR](https://img.shields.io/badge/WebXR-Quest-5b4bdb?logo=meta&logoColor=white)](https://immersiveweb.dev/)
[![Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-d22128)](./LICENSE)

</div>

MMD XR Stage is a single-purpose VR showcase for user-provided MMD (MikuMikuDance) content: drop in PMX/PMD models, VMD motions, and audio on the prep page, then enter immersive VR on a Quest headset.

## Features

- In-headset HUD with quality presets, model transform controls, height adjustment, snap turning, and exposure/lighting looks.
- Meta Quest hand tracking with articulated hands, pinch-based HUD interaction, and hand-to-model physics collision.
- Optional controller collision, contact haptics, physics quality controls, and session-safe model disposal.
- WebXR MSAA on WebGL2 projection layers (three 0.186) via the antialias quality axis.
- Local-first: assets never leave the browser; preferences persist locally.

## Stack

| Area | Technology |
| --- | --- |
| Application | React 19, TypeScript, Vite |
| 3D and XR | Three.js 0.186, React Three Fiber, React Three XR |
| MMD | `@yohawing/three-mmd-loader@0.8.3` (patched), Bullet WASM |
| State | Zustand |
| Hosting | Cloudflare Pages |

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm test` | Run the Vitest suite once |
| `pnpm build` | Type-check and create the production build |
| `pnpm deploy` | Build and deploy `dist` to Cloudflare Pages |

## WebXR Requirements

- Immersive VR requires a browser and device supporting WebXR `immersive-vr`.
- Production XR must run from a secure HTTPS origin; `localhost` is allowed during development.
- Hand tracking is requested as an optional WebXR capability at session creation; the HUD can toggle its visuals, interaction, and physics collision.
- Desktop browser tests cannot replace headset validation. Regression items: model scaling, cloth fall/contact, panel persistence, controller and hand collisions, contact counts, and haptics.

## Local Data

Preferences and session settings are stored locally via `localStorage`. Clearing site data resets them. Imported MMD models, motions, textures, and audio remain local to the browser; this repository ships no character or motion assets. Use only assets whose creator terms permit your intended use.

## Licensing

Licensed under the [Apache License 2.0](./LICENSE). Bullet runtime attribution lives in [docs/THIRD_PARTY_NOTICES.md](./docs/THIRD_PARTY_NOTICES.md).
