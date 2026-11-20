<div align="center">

# MMD XR Stage

**A standalone WebGL + WebXR MMD showcase built for Meta Quest.**

[![React 19](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.187-111111)](https://threejs.org/)
[![WebXR](https://img.shields.io/badge/WebXR-Quest-5b4bdb?logo=meta&logoColor=white)](https://immersiveweb.dev/)
[![Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-d22128)](./LICENSE)

[Open the stage](https://mmd-xr-stage.pages.dev) · [Documentation](./docs/README.md) · [Deployment notes](./docs/deployment.md)

</div>

Bring your own characters, props and motions into a shared 3D stage. Watch on a regular screen with a mouse or touch, or step into the same set in VR on Meta Quest.

## Import to the backpack, then place on stage

1. Drop a folder, ZIP or loose files onto the prep page. Keep models and their textures together. PMX/PMD files are characters, GLB/glTF files are props, and VMD/VPD files supply motions or poses. The [offline Windows converter](./docs/gameplay/blender-characters.md) turns a supported Blender character into a stage-ready ZIP with a PMX model, textures, facial shapes and supported rigid-body constraints.
2. Choose **Watch on screen** or enter VR. A fresh stage starts empty. Open the **Backpack**, pick a character or prop, and point to a free spot to place it. Select a placed character to assign a motion, turn it or change its size.
3. To swap characters, put one back in the backpack and place another. You can return to a set’s layout while the tab stays open. Refreshing clears the backpack and layouts; preferences are stored locally.

**The backpack has no separate model-count limit.** For example, you can import ten character models and choose which three to place. Each active set supports **up to three placed characters and three imported props at once**. Hiding a character keeps its slot; putting it away frees the slot. Built-in scenery does not use these slots.

Import budgets apply to files, including textures and ZIP contents: **4,096 entries, 256 MiB per file and 512 MiB total imported data**. Files stay on your device. The import report identifies missing textures and conflicting paths before you enter.

## Stage gallery

**Double Happiness Courtyard · 双喜堂.** Walk past the [embroidered bridal sedan](./docs/screenshots/wedding-bridal-sedan.webp) into the banquet courtyard. Place two characters side by side in front of the wedding altar, then take the guest’s view from the table or step into the dressing room for a portrait by the bronze mirror.

Choose **Lacquer and roof tiles** in the courtyard or **Window-side desk** in the classroom to see how the surfaces catch the light. [Gate close-up](./docs/screenshots/wedding-materials/near.webp) · [Desk close-up](./docs/screenshots/classroom-window-desk.webp).

![A red bridal sedan beside a tiled gate, with the banquet table visible through the open doors.](./docs/screenshots/wedding-court-entry.webp)

**Campus walk.** Leave the classroom through its rear door and follow the covered passage into the meadow. The blue-tiled gate leads to the pool; a separate garden path takes you under the clinic canopy into the waiting hall. Each set keeps its own layout, so you can leave a character in the classroom and find it there when you return.

![Afternoon light across the desks and parquet floor of the window-side classroom.](./src/mmdVrShowcase/prep/classroom-window.webp)

| Wisteria meadow | Pool terrace |
| :---: | :---: |
| ![Flowers along the path beneath the arbor.](./docs/screenshots/wisteria-path.webp) | ![The pace clock and lifeguard chair beside the lanes.](./docs/screenshots/lido-timing-deck.webp) |

**Qinhuai Songhouse · 泊月楼.** Place a character on the timber stage, then take the outside stairs to the [upper listening gallery](./docs/screenshots/qinhuai-gallery.webp) for a second view of the performance. Two close-up viewpoints take you to the [lacquered seven-string zither](./docs/screenshots/qinhuai-detail-zither-after.webp) and the [boat’s mooring line](./docs/screenshots/qinhuai-detail-mooring-after.webp).

![The songhouse entrance from the river landing, with lanterns over the doors and the stairs on the left.](./docs/screenshots/qinhuai-entry.webp)

For a different setting, follow the [chapel aisle into the garden](./docs/screenshots/chapel-water-court.webp), cross the [observatory causeway](./docs/screenshots/observatory-return.webp), or arrange a performance in the [Live House](./docs/screenshots/live-house.webp).

## Features

### Three short scenes to play

| Kite stand | Bubble ferry | Encore print |
| :---: | :---: | :---: |
| ![A paper kite rising beside the meadow bench.](./docs/screenshots/kite-stand.webp) | ![A striped ferry crossing the pool.](./docs/screenshots/bubble-ferry.webp) | ![A sunrise print on the club curtain.](./docs/screenshots/encore-print.webp) |

Fly the kite from a character's wrist, send the ferry across the pool, or change the club backdrop and hand over the microphone. A fourth vignette, Lunar Post, lets you stamp a postcard on the studio plinth.

### Prep page

- Import preserves relative paths to textures and external glTF buffers. The [import guide](./docs/gameplay/asset-workflow.md) covers filename encodings, conflicting paths and how to repair a missing reference.
- The prep page checks for a secure context and WebXR support before entry. Quest quality presets offer separate overrides for refresh rate, framebuffer scale, foveation, antialiasing, shadows and device pixel ratio.

### Viewing controls

- **On screen:** drag to orbit or scroll/pinch to zoom. With the view focused, use **WASD** to move, **Q / E** to turn clockwise / counterclockwise, **F / C** to rise / descend, and **R** to reset. **Tour viewpoints** jumps to a spot in the set.
- **In VR:** press **B** on the right controller to recall the viewing menu. With hand tracking, raise your left wrist and point at **Menu** with the other hand. Playback, the backpack and scenery selection are available inside the stage.
- **Movement:** under **B → More → Player**, normal mode walks on solid floors and jumps with **A**. Free mode passes through scenery; push the right stick forward to rise or back to descend. Both modes offer 1.2, 2.4, 4.8 and 8 m/s travel.
- **Local music:** optionally choose one audio file on the prep page. Play, pause and adjust its volume from the screen controls or the VR menu. Music continues across sets and stops when you exit; it has its own clock, independent of character motions.
- **Scene people:** where a set has built-in people, toggle them in **Backpack → Environment** on screen or **B → More → Environment** in VR. Your imported characters stay on stage.
- **Physics:** controller and tracked-hand colliders interact with cloth during playback and while paused. Controller contact can trigger haptics. Hiding the hand models leaves the menu rays available.
- **Diagnostics:** after exiting VR, export the JSON session report from the prep page. It records the requested settings, the refresh rate and layer dimensions reported by the session, XR frame intervals, model-update CPU time and renderer draw counts. Placement, physics switching and room restoration are timed separately. XR callback intervals are not GPU timings.

## Stack

| Area | Technology |
| --- | --- |
| Application | React 19, TypeScript, Vite |
| 3D and XR | Three.js r187, React Three Fiber 9.8, `@react-three/xr` 6.6.32 |
| MMD animation and physics | `@yohawing/three-mmd-loader` 0.8.6 (patched), Bullet WebAssembly |
| State | Zustand |
| Hosting | Cloudflare Pages |

Desktop and immersive views share the backpack and stage layouts. Only the active set mounts models and creates their Bullet worlds. Returning to a set restores its actors and motions from the saved layout. The [loader maintenance notes](./docs/three-mmd-loader-maintenance.md) document the version-matched Bullet assets and loader patches.

## WebXR requirements

Screen viewing requires WebGL 2. Immersive viewing also needs a browser and headset that support `immersive-vr`, served over HTTPS or localhost. The production renderer uses WebGL; the [WebGPU XR investigation](./docs/webgpu-xr-status.md) tracks that separate path.

The app requests hand tracking as an optional session feature. It marks VR entry as active when the renderer receives its first `XRFrame`, rather than when the session request resolves. WebGL 2 projection layers support MSAA via the antialias setting. See the [XR session lifecycle](./docs/xr-session-lifecycle.md) for startup and teardown. Controller collision and haptics target Meta Quest Browser; desktop simulation does not establish headset comfort or frame rate.

## Run locally

Use Node.js **26.12.1** and pnpm **11.20.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm test` | Run the Vitest suite once |
| `pnpm build` | Type-check the project and build `dist/` |
| `pnpm deploy` | Build and deploy `dist/` to Cloudflare Pages |

## Local data

Preferences persist in `localStorage`. Imported files and stage layouts stay in page memory until refresh. ZIP packages are unpacked locally with UTF-8, Shift-JIS or GBK filename decoding; encrypted archives are not supported.

## Deployment

Production uses direct upload to the existing `mmd-xr-stage` Pages project. The Git branch is `master`; the Pages production branch is `main`. The [deployment notes](./docs/deployment.md) cover the pinned Wrangler command, older open tabs and how to verify deployed assets against the tested build.

## Licensing

[Apache License 2.0](./LICENSE) · [Third-party notices](./docs/THIRD_PARTY_NOTICES.md). Character and motion assets are supplied by the viewer.
