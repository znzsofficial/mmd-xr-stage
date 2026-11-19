# MMD XR Stage Agent Guide

## Project Shape

- Built-in modelling is environment content for imported characters. Use `scenery/catalog.ts` as the set identity across prep, HUD, layouts and reports. Author placeable ground together with the layout: a point inside furniture or over pool water cannot be accepted just because the pointing plane intersects it.
- When expanding scenery, build connected destinations at human scale, with room to place the user's actors at each one. Check the walk in XR, the screen camera, and the actual placement ray at the far end; decorating the starting spot or enlarging a skybox does not extend the playable space.
- The backpack owns file references for the lifetime of this page. Import is not a stage spawn; a fresh XR entry can have zero models. Keep runtime IDs separate from stable asset IDs; only mounted instances consume the three character/three object slots. Keep complete scene layouts as data, not hidden GPU/Bullet instances. End/switch invalidates command tokens only after taking any valid snapshot. Placement yaw is in **degrees** at the store boundary.

- When resuming this work, read `docs/HANDOFF.md` first. Keep it short; put play status and instructions in `docs/gameplay/`, modelling in `docs/scenery/`, and timing evidence plus optimization priorities in `docs/performance/`. Read `PRODUCT.md` and `DESIGN.md` before VR UI edits; the porcelain palette is scoped to HUD, not the prep page or stage lighting.

- Single-purpose WebGL + WebXR MMD showcase for Meta Quest. Prep page at `/` (`index.html` -> `src/main.tsx` -> `src/mmdVrShowcase/MmdVrPrepApp`), XR scene entered from there.
- `src/mmdVrShowcase/` owns the entire product surface: prep UI, XR session, scene, HUD, colliders, haptics, physics reseed.
- `src/xr/` owns XR detection, session creation (`createProductXrSession`), pending-session attachment, and quality axes. One XR store + session per product surface; never share instances.
- XR startup follows requesting/created/bound/presenting in the session slot; active means the current renderer delivered an XRFrame, not just requestSession success. Scope cleanup to its generation. R3F owns the renderer created by Canvas's gl props; do not add another gl.dispose. See `docs/xr-session-lifecycle.md`.
- Do not write runtimeRef or publish store state inside useMemo. StrictMode can retain one computed runtime while the ref points at the discarded one, making model loads look stale. Publish the committed handle in a layout effect.
- `screen/` presents the same stage through a regular WebGL Canvas and DOM controls. It owns no XR session, controller input or XR performance recording. The shared room and page backpack alone own actors and layouts. This viewer is not the separate window-manager/desktop product.

## Commands

```bash
pnpm install
pnpm exec tsc -b --pretty false
pnpm test
pnpm build
git diff --check
pnpm deploy
```

- `pnpm test` runs Vitest in the Node environment; some component tests use a `// @vitest-environment jsdom` pragma. jsdom in this setup does NOT provide `localStorage` — stub it in tests.
- There is no lint script. CI-equivalent validation is `tsc -b` + `pnpm test` + `pnpm build`.
- Use Node 26.12.1 (`.node-version`, engines `>=26.12.1 <27`), matching jsdom 31 and Node 26 types. Do not follow npm's `node` latest tag into Node 27 alpha.

## MMD Loader And Assets

- The runtime is pinned to `@yohawing/three-mmd-loader@0.8.6` with Three.js r187.
- Keep the matching Bullet files in `public/mmd/0.8.6/mmd_bullet.js` and `public/mmd/0.8.6/mmd_bullet.wasm`, and keep the path in `src/mmdVrShowcase/*` synchronized when versioning.
- Keep the loader entry in `pnpm-workspace.yaml` (`patchedDependencies`) and `patches/@yohawing__three-mmd-loader@0.8.6.patch`. The published package still lacks `debugPhysicsContactsForRigidBodyRange()`; the patch filters the native debug contact buffer by rigid-body range and is required for controller/hand contact diagnostics and haptics. The patch also carries a three r186/r187 compat shim for the loader's experimental TSL self-shadow pass (degrades to no-op; see `docs/three-mmd-loader-maintenance.md`). In 0.8.6 it must also handle nullable material disposal and release the retained shadow projection; `mmdLoaderCompatibility.test.ts` covers this lifecycle.
- Keep `patches/@pmndrs__xr@6.6.32.patch` alongside it: it fixes `@pmndrs/xr` input-source state cleanup (listener/map leak when a controller input source is replaced). `src/xr/xrInputLifecycle.test.ts` fails without it even on 6.6.32.
- Keep one resolved `@types/three` version matching the renderer. Loader declares it as a broad dependency; a stale nested version causes incompatible Object3D/Material types. Update the transitive resolution rather than casting application code.
- The scoped Zustand v4 overrides select 4.5.7 for XR's existing v4 ranges, allowing a React-19-compatible `use-sync-external-store`. Do not redirect those dependencies to Zustand v5.
- When upgrading the loader, follow `docs/three-mmd-loader-maintenance.md`: verify upstream API coverage, update versioned assets and docs, run `pnpm install`, then rerun focused physics/haptics tests, the full suite, TypeScript, and the build. Do not remove the patch merely because the upstream version changed.
- The loader clone at `E:\WebProjects\three-mmd-loader` uses npm and `package-lock.json`; do not use pnpm there.

## XR And Physics Invariants

- XR collider recovery must not turn the parked pose into a high-speed strike. Re-arm each discontinuous slot only after it stays clear of the model's native dynamic-body bounds for two fixed-step durations. Regular tracked strokes go straight through. The loader patch also exposes `readRigidBodyCenters` for a shared, on-demand recovery check; never reset the whole Bullet world on a tracking change.

- Keep VMD pose seconds separate from Bullet's bounded XR-frame delta. Paused interactive physics may advance even at pose 0. Seek, loop and reset are seed-only at the requested pose, not accumulated playback time. Exercise `scripts/paused-cloth-smoke.html` with the shipped Bullet backend when changing either clock.
- For secondary-motion jitter, `PhysicsPoseDisplay` owns only the displayed pose of bones reported by Bullet. Restore raw local poses before evaluation, clear history on discontinuities and keep rotation-only bodies' animated local translations. Independently smoothing local rotation down a long chain can amplify hem movement. Measure skinned vertices as well as bone transforms; avoid committing private PMX assets or their paths.
- Enhancement map loads commit complete sets per material. Compare actual File identities; invalidate pending work on selection changes and disposal, including reselecting the already committed files. Keep the last complete set on decode failure.

- Keep `MmdVrScene` statically reachable from the prep entry, but mount Canvas only on enter. After a release an already-open tab can otherwise fetch SPA HTML at a retired lazy chunk URL. Exercise the built prep page with a selected PMX and a simulated XR frame, not just individual asset HTTP checks. See `docs/deployment.md` for the temporary old-tab bridge.

- XR input profiles and controller/hand models must stay same-origin via `createAppXrStore.baseAssetPath` and `public/xr-input/1.0.20/`. The upstream default CDN is a functional dependency: a failed controller profile fetch prevents controller state and pointers from being created. Keep the local profile index limited to bundled files, preserve generic fallback and license notices, and test actual trigger/pinch events rather than only invoking HUD callbacks.

- MMD XR must request the optional `hand-tracking` feature when the session is created. This allows hand tracking to be enabled after entering XR; preserve `beginFromClick(init?)` initialization passthrough.
- `handTracking` is the persisted preference name and defaults to `true`. Do not reintroduce `handDetail`.
- Hand colliders use 12 fixed slots: each wrist anchors a palm box and the five tips anchor rounded distal finger pads. `handContactProfile.ts` defines the same dimensions and poses for physics and debug meshes (box half-extents, capsule radius and center-to-center length). Keep shape dimensions stable across poses: in loader 0.8.6 changing rigid-body definitions recreates the Bullet world. Convert dimensions by model scale independently of the rigid transforms.
- Physics wrapper order is `[model, controller colliders (2), hand colliders (12)]`: the controller wrapper is outermost and added first, with the hand wrapper inside it. Controller contact indexing starts at the original `sourceRigidBodyCount`; do not add the 12 hand slots to that offset. Forward contact diagnostics through every wrapper.
- Controller and hand providers must use the shared model visual-space mapping and WebXR-to-MMD coordinate conversion.
- Preserve the controller matrix scale normalization and the independent collider-radius/model-scale conversion. These are needed for scaled models and cloth contact.
- Physics wrappers cache immutable body definitions by array identity, matching the loader. Replace `rigidBodies` when definitions change. Copied buffers are per-wrapper scratch: preserve prefix copying and tail clearing on every step, and never retain them as historical snapshots. Controller contact counts must exclude synthetic-to-synthetic contacts (hidden colliders overlap at Y=-1000) and hidden/disposed models. See `docs/performance/xr-runtime-performance.md` for benchmarks and the native Bullet smoke check.
- Ordinary GLB/glTF environment meshes use bounding-sphere frustum culling via `prepareStageObject`; skinned/morph meshes remain conservative. PMX character culling remains disabled. Do not freeze the movable object root's matrices.
- Put routine model operations at the selected target. Right-controller B recalls the common menu; provide a backpack path to selecting hidden or occluded items. Keep advanced pages at a common panel position. Trigger release activates once even on a slow press. Ordinary hand contact with clothes must never select or translate the character. See `docs/gameplay/vr-controls.md`.

## Verification And Files

- For completed product changes, finish the release for the user: after verification, merge, push normally, deploy the tested build to the existing production Pages project per `docs/deployment.md`, and verify the main domain. Report the live link instead of handing the user a release command. If a check or deployment fails, report the blocker. This routine does not authorize force pushes.

- Browser checks do not replace Quest hardware validation. For XR/physics changes, manually regress model scaling, cloth fall/contact, panel persistence, controller and hand collisions, controller contact counts, and haptics.
- `sample/` is ignored; model assets must never be committed. `.gitattributes` expects LF text and treats `*.wasm` as binary.
- Update `docs/THIRD_PARTY_NOTICES.md` when changing bundled third-party versions.
