# MMD XR Stage

Bring your own characters, props and motions into a shared 3D stage. Watch on a regular screen with a mouse or touch, or step into the same set in VR on Meta Quest.

[Open the stage](https://mmd-xr-stage.pages.dev) · [Import guide](./docs/gameplay/asset-workflow.md) · [Blender character converter](./docs/gameplay/blender-characters.md)

## Import to the backpack, then place on stage

1. Drop a folder, ZIP or loose files onto the prep page. Keep models and their textures together. PMX/PMD files are characters, GLB/glTF files are props, and VMD/VPD files supply motions or poses. For a supported Blender character, convert it locally and import the resulting ZIP.
2. Choose **Watch on screen** or enter VR. A fresh stage starts empty. Open the **Backpack**, pick a character or prop, and point to a free spot to place it. Select a placed character to assign a motion, turn it or change its size.
3. To swap characters, put one back in the backpack and place another. You can return to a set’s layout while the tab stays open. Refreshing clears the backpack and layouts; preferences are stored locally.

**The backpack has no separate model-count limit.** For example, you can import ten character models and choose which three to place. Each active set supports **up to three placed characters and three imported props at once**. Hiding a character keeps its slot; putting it away frees the slot. Built-in scenery does not use these slots.

Import budgets apply to files, including textures and ZIP contents: **4,096 entries, 256 MiB per file and 512 MiB total imported data**. Files stay on your device. The import report identifies missing textures and conflicting paths before you enter.

## Stage gallery

**Campus walk.** Leave the classroom through its rear door, follow the covered passage into the meadow, and walk under the blue-tiled gate to the pool. Each set keeps its own layout, so you can leave a character in the classroom and find it there when you return.

![Afternoon light across the desks and parquet floor of the window-side classroom.](./src/mmdVrShowcase/prep/classroom-window.webp)

| Wisteria meadow | Pool terrace |
| :---: | :---: |
| ![Flowers along the path beneath the arbor.](./docs/screenshots/wisteria-path.webp) | ![The pace clock and lifeguard chair beside the lanes.](./docs/screenshots/lido-timing-deck.webp) |

**Qinhuai Songhouse · 泊月楼.** Place a character on the timber stage, then take the outside stairs to the [upper listening gallery](./docs/screenshots/qinhuai-gallery.webp) for a second view of the performance.

![The songhouse entrance from the river landing, with lanterns over the doors and the stairs on the left.](./docs/screenshots/qinhuai-entry.webp)

For a different setting, follow the [chapel aisle into the garden](./docs/screenshots/chapel-water-court.webp), cross the [observatory causeway](./docs/screenshots/observatory-return.webp), or arrange a performance in the [Live House](./docs/screenshots/live-house.webp).

### Three short scenes to play

| Kite stand | Bubble ferry | Encore print |
| :---: | :---: | :---: |
| ![A paper kite rising beside the meadow bench.](./docs/screenshots/kite-stand.webp) | ![A striped ferry crossing the pool.](./docs/screenshots/bubble-ferry.webp) | ![A sunrise print on the club curtain.](./docs/screenshots/encore-print.webp) |

## Viewing controls

- **On screen:** drag to orbit, use the wheel or pinch to zoom, and select **Tour viewpoints** to visit a spot in the set.
- **In VR:** press **B** on the right controller to recall the viewing menu. With hand tracking, raise your left wrist and point at **Menu** with the other hand. Playback, the backpack and scenery selection are available inside the stage.
- **Physics and performance:** character physics supports cloth interaction during playback and while paused. Graphics settings include shadows, render scale and refresh-rate requests. After leaving VR, you can export the session report from the prep page.

## Run locally

Use Node.js **26.12.1** and pnpm **11.20.0**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm test` runs the tests. `pnpm build` type-checks the project and writes the production build to `dist/`. The viewer uses React, Three.js, WebGL 2 and a patched `@yohawing/three-mmd-loader` with Bullet WASM. Immersive VR requires WebXR and a secure origin (HTTPS or localhost). See the [deployment notes](./docs/deployment.md) for the release workflow.

## Licensing

[Apache License 2.0](./LICENSE) · [Third-party notices](./docs/THIRD_PARTY_NOTICES.md). Character and motion assets are supplied by the viewer.
