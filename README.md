<div align="center">

# MMD XR Stage

**A standalone WebGL + WebXR MMD showcase built for Meta Quest.**

[![React 19](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.187-111111)](https://threejs.org/)
[![WebXR](https://img.shields.io/badge/WebXR-Quest-5b4bdb?logo=meta&logoColor=white)](https://immersiveweb.dev/)
[![Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-d22128)](./LICENSE)

[Live site](https://mmd-xr-stage.pages.dev) · [Documentation](./docs/README.md) · [Handoff](./docs/HANDOFF.md) · [Deployment notes](./docs/deployment.md)

</div>

MMD XR Stage is a single-purpose VR showcase for user-provided MMD (MikuMikuDance) content: drop in PMX/PMD models, VMD motions and GLB/glTF environment assets on the prep page, then enter immersive VR on a Quest headset. BGM playback is not implemented.

## Features

### Prep Page

- Import folders, ZIP packages, or individual model, motion and scene files. Relative texture paths are preserved; missing resources and path conflicts appear in an import report.
- The prep page can prepare the first selected character and its textures before entry. You can enter immediately or wait for the ready hint; GPU upload uses the XR renderer.
- Continue the previous stage in the same browser tab, restoring placement, materials, visibility and playback position, or start over with the current selection.
- Quest quality presets (safe / balanced / clarity) plus per-axis overrides: frame rate, framebuffer scale, foveation, antialias, shadows, DPR.
- Live XR readiness probe: secure context, `navigator.xr` availability, and an advisory `immersive-vr` support check, surfaced before you enter.

### In VR

- View your character on a simple floor, at a live venue, in a window-lit classroom, by an outdoor pool, or on a meadow. Choose the environment on the prep page or switch it in the VR visual settings. Built-in scenery uses no imported object slots.
- Compact viewing controls keep play/pause, panel expansion and exit within reach; loading and physics errors remain accessible while the adjustment panel is closed.
- Render diagnostics distinguish requested settings, session-reported refresh/layer properties, callback cadence, model-update CPU cost and renderer resource/draw counters. No GPU time is inferred from these values.
- After exit, [export the last session's performance report](./docs/viewing-and-diagnostics.md) from the prep page before refreshing. It includes startup checkpoints and frame-interval percentiles.
- In-headset HUD with quality controls, model transform, height adjustment, snap turning, and exposure/lighting looks.
- Meta Quest hand tracking with articulated hands, pinch-based HUD interaction, and hand-to-model physics collision.
- Optional controller collision, contact haptics, physics quality controls, and session-safe model disposal.
- WebXR MSAA on WebGL2 projection layers (Three.js r187, supported since r186) via the antialias quality axis.

## Stack

| Area | Technology |
| --- | --- |
| Application | React 19, TypeScript, Vite |
| 3D and XR | Three.js 0.187, React Three Fiber 9.8, React Three XR 6.6.32 |
| MMD | `@yohawing/three-mmd-loader@0.8.6` (patched), Bullet WASM |
| State | Zustand |
| Hosting | Cloudflare Pages |

## Quick Start

Requirements:

- Node.js `26.12.1` (Node 26; see `.node-version`)
- pnpm `11.20.0` (pinned in `packageManager`)

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

Production uses WebGL. WebGPU-in-WebXR now has browser and Three.js implementations, but this app has not migrated its session and MMD shader pipeline; see [the dated support investigation](./docs/webgpu-xr-status.md).

- Immersive VR requires a browser and device supporting WebXR `immersive-vr`.
- Production XR must run from a secure HTTPS origin; `localhost` is allowed during development. The prep page reports an insecure context or a missing WebXR runtime before you attempt to enter.
- Hand tracking is requested as an optional WebXR capability at session creation. Its availability depends on the headset and browser; the in-headset HUD can enable or disable its visuals, interaction, and physics collision.
- Controller collision and haptics were built and validated against the Meta Quest Browser; other headsets are untested.
- Desktop browser tests cannot replace headset validation. Regression items: model scaling, cloth fall/contact, panel persistence, controller and hand collisions, contact counts, and haptics.

## Local Data

Preferences are stored locally via `localStorage`. Imported files and the previous-stage snapshot stay in page memory and are cleared on refresh. ZIP imports support UTF-8 and optional Shift-JIS/GBK filename decoding; encrypted archives are not supported. See [asset import and stage resume](./docs/asset-workflow.md) for limits and recovery behavior. This repository ships no character or motion assets. Use only assets whose creator terms permit your intended use.

## Deployment

The production build is written to `dist` and deployed to the `mmd-xr-stage` Cloudflare Pages project (<https://mmd-xr-stage.pages.dev>) via `pnpm deploy`. See [docs/deployment.md](./docs/deployment.md) for deployment notes and wrangler caveats.

## Licensing

Licensed under the [Apache License 2.0](./LICENSE). Bullet runtime attribution lives in [docs/THIRD_PARTY_NOTICES.md](./docs/THIRD_PARTY_NOTICES.md).
