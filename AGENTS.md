# MMD XR Stage Agent Guide

## Project Shape

- For shared stage changes start at `docs/architecture.md`. `components/MmdVrStage.tsx` owns the viewing-session caches and room generation; `stage/StageRoom.tsx` owns the mounted runtime and snapshot validity. Put shared render-only scenery in `stage/StageEnvironment.tsx` and preference normalization in `settings/preferences.ts`.

- Built-in modelling is environment content for imported characters. Use `scenery/catalog.ts` as the set identity across prep, HUD, layouts and reports. Author placeable ground together with the layout: a point inside furniture or over pool water cannot be accepted just because the pointing plane intersects it.
- For a click/release switch built into scenery, use `scenery/input/useSceneAction` with the room's actual sightline. A second ray must not steal or cancel the first ray's press; a placement, HUD or room transition invalidates it even if React batches the transition. Keep the resulting light, cloth or instrument state with its owner.
- Register each set’s actor placement once in `scenery/placementAreas.ts`: `resolve` returns valid world Y or `null`, with pick decks and sight checks on the same entry. Renderers, bake scripts and the player motor import dimensions from their layout modules, not from the placement registry.
- When expanding scenery, build connected destinations at human scale, with room to place the user's actors at each one. Check the walk in XR, the screen camera, and the actual placement ray at the far end; decorating the starting spot or enlarging a skybox does not extend the playable space.
- For procedural shader changes, exercise the actual material in WebGL and check `COMPILE_STATUS` or renderer shader errors, not just `pageerror`, HTTP or the build. Negative layout constants interpolated after a minus can become GLSL `--`; check the rendered surface from close range.
- For the opal sky, keep star cores and ring silhouettes independent of panorama resolution. Use per-eye, bounded parallax for finite-distance layers; compare fixed-heading translation and a subpixel turn, as well as a still shot, before judging the background in XR.
- Register independent areas in `scenery/catalog.ts`, `roomSets.tsx`, and `roomViews.ts`. Use directed records in `connections.ts` for crossings shared by XR movement and screen tours. Rooms on the same continuous floor (e.g. the clinic) share a scene lifetime; constrain placement rays with the actual walls and door openings. See `docs/scenery/adding-a-set.md`.
- A menu jump can reset the XR view to a room entrance; a walk across a shared doorway must instead retain its translated origin, heading and tracked offset. Rebase the previous thumbstick origin at the seam so wall collision does not sweep across the coordinate change.
- Site connections from both ends before detailing a corridor. Join an actual doorway to a useful path or landing; from a standing eye, the next stretch of floor and destination landmark should be visible together. Inspect the reverse arrival for a missing ground plane, posts masking the turn or signs pointing into scenery. A working trigger alone does not validate the site.
- Keep the player's normal movement (solid geometry, support, jump and gravity) separate from free flight (no solids or automatic gates), backpack placement and hand/cloth physics. A physical lean past the walk boundary must follow the headset without masking, fading or pushing the camera back. Don't feed flight altitude or jump displacement into tracked eye height or persisted preferences. Exercise real controller axes/buttons, low overhead geometry and an elevated landing.
- Author `propCatalog.grip` in rendered piece coordinates. Animated wrist orientations differ across skeletons and sides; fit the bind-space finger and palm axes, keep the handle fixed while adjusting orientation, and never rotate the actor's wrist or fingers to fit the prop. See `docs/gameplay/prop-authoring.md`.
- The backpack owns file references for the lifetime of this page. Import is not a stage spawn; a fresh XR entry can have zero models. Keep runtime IDs separate from stable asset IDs; only mounted instances consume the three character/three object slots. Keep complete scene layouts as data, not hidden GPU/Bullet instances. End/switch invalidates command tokens only after taking any valid snapshot. Placement yaw is in **degrees** at the store boundary.

- When resuming this work, read `docs/HANDOFF.md` first. Keep it short; put play status and instructions in `docs/gameplay/`, modelling in `docs/scenery/`, and timing evidence plus optimization priorities in `docs/performance/`. Read `PRODUCT.md` and `DESIGN.md` before VR UI edits; the porcelain palette is scoped to HUD, not the prep page or stage lighting.

- Single-purpose WebGL + WebXR MMD showcase for Meta Quest. Prep page at `/` (`index.html` -> `src/main.tsx` -> `src/mmdVrShowcase/MmdVrPrepApp`), XR scene entered from there.
- `src/mmdVrShowcase/` owns the entire product surface: prep UI, XR session, scene, HUD, colliders, haptics, physics reseed.
- `src/xr/` owns XR detection, session creation (`createProductXrSession`), pending-session attachment, and quality axes. One XR store + session per product surface; never share instances.
- XR startup follows requesting/created/bound/presenting in the session slot; active means the current renderer delivered an XRFrame, not just requestSession success. Scope cleanup to its generation. R3F owns the renderer created by Canvas's gl props; do not add another gl.dispose. See `docs/xr-session-lifecycle.md`.
- Do not write runtimeRef or publish store state inside useMemo. StrictMode can retain one computed runtime while the ref points at the discarded one, making model loads look stale. Publish the committed handle in a layout effect.
- `screen/` presents the same stage through a regular WebGL Canvas and DOM controls. It owns no XR session, controller input or XR performance recording. The shared room and page backpack alone own actors and layouts. This viewer is not the separate window-manager/desktop product.
- Keep mouse-wheel zoom in screen viewing. Keyboard translation moves both eye and orbit target; keyboard yaw turns around the eye. After camera changes, test turning and moving with the keys, then zooming in and out with the actual wheel and dragging to orbit before resetting the current room.
- For PMX color comparisons, keep the same evaluated pose and compare character pixels rather than global screenshots. Default toon highlights should retain clothing and skin detail; keep the original bright grade available without changing the room lighting or the user's global exposure. See `docs/scenery/model-highlight-color.md`.
- Only the XR planetoid mounts Ecctrl/Rapier. Keep its WASM off the static prep and screen import graph; the renderer/hand colliders and MMD Bullet worlds remain separate. Sample controller impulses and the bounded planet step on the same clock. Check recall and snap turns in the local tangent frame at the antipode.
- Keep globe input and the XR origin usable before the optional physics module resolves, and on failure. A working B menu is not proof of locomotion. Check both sticks with a delayed or denied WASM on first entry and re-entry. Keep the product Vite dependency scan on `index.html`: scanning the standalone experiments can load a second React/Fiber in dev.
- The wind lanes and nearby moons share the active opal room. Park the mother-planet driver through flight, lunar walking and twin jumps; only reseed it at the actual return foot. Moon walking, jump marks and the rendered shell must use the same relief; narrow sub-triangle fissures belong in the surface print. For a jump between opposing surfaces check head clearance as well as foot clearance, both directions, a held button through touchdown, tracking loss, and return from the other moon.

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

- Dance self-contact must preserve the authored arm, wrist and hand trajectories. Use those segments as read-only contact probes. Deform only dedicated chest bones after evaluation, restore raw transforms before the next VMD/Bullet step, and compare arm matrices and weighted vertices. Do not steer the arms around the torso.
- Manual posing is explicit. Freeze an independent animation input, not the displayed/post-physics bones; drag that clip without rebinding the solver. Verify planted feet, wrist-driven bodies and restoration of the original evaluator/IK on both static and dancing PMX. Named poses and body settings belong to the backpack asset; do not retain live skeletons on room changes. Apply the day's base chest shape before pressure and unwind display layers in reverse order before evaluating again.
- Put viewing and contact controls on the stage. The user rarely opens prep; reserve it for import, launch and device setup.

- XR collider recovery must not turn the parked pose into a high-speed strike. Re-arm each discontinuous slot only after it stays clear of the model's native dynamic-body bounds for two fixed-step durations. Regular tracked strokes go straight through. The loader patch also exposes `readRigidBodyCenters` for a shared, on-demand recovery check; never reset the whole Bullet world on a tracking change.

- Keep VMD pose seconds separate from Bullet's bounded XR-frame delta. Paused interactive physics may advance even at pose 0. Seek, loop and reset are seed-only at the requested pose, not accumulated playback time. Exercise `scripts/paused-cloth-smoke.html` with the shipped Bullet backend when changing either clock.
- For motorized props, sample the visual beat and holder's haptics on the same render-frame clock, even with VMD paused. Mix a surface-contact accent into an unsent beat. On interruption cancel only a still-active pulse owned by that driver; a late actuator fallback must not restart a stopped or transferred prop.
- For secondary-motion jitter, `PhysicsPoseDisplay` owns only the displayed pose of bones reported by Bullet. Restore raw local poses before evaluation, clear history on discontinuities and keep rotation-only bodies' animated local translations. Independently smoothing local rotation down a long chain can amplify hem movement. Measure skinned vertices as well as bone transforms; avoid committing private PMX assets or their paths.
- Enhancement map loads commit complete sets per material. Compare actual File identities; invalidate pending work on selection changes and disposal, including reselecting the already committed files. Keep the last complete set on decode failure.

- Keep `MmdVrScene` statically reachable from the prep entry, but mount Canvas only on enter. After a release an already-open tab can otherwise fetch SPA HTML at a retired lazy chunk URL. Exercise the built prep page with a selected PMX and a simulated XR frame, not just individual asset HTTP checks. See `docs/deployment.md` for the temporary old-tab bridge.

- XR input profiles and controller/hand models must stay same-origin via `createAppXrStore.baseAssetPath` and `public/xr-input/1.0.20/`. The upstream default CDN is a functional dependency: a failed controller profile fetch prevents controller state and pointers from being created. Keep the local profile index limited to bundled files, preserve generic fallback and license notices, and test actual trigger/pinch events rather than only invoking HUD callbacks.

- MMD XR must request the optional `hand-tracking` feature when the session is created. This allows hand tracking to be enabled after entering XR; preserve `beginFromClick(init?)` initialization passthrough.
- `handTracking` is the persisted **hand model visibility** preference and defaults to `true`. A hidden hand model must keep its menu ray. Player hand/controller contact is basic XR physics: always available when character physics is on, including while paused. Never restore a separate contact switch from a room snapshot. Dance chest compression defaults on independently of Bullet. The optional missing-palm workaround is for the character, not the player. Keep settings under `settings/` and device requests in `prep/DeviceSettings.tsx`.
- Hand colliders use 12 fixed slots: each wrist anchors a palm box and the five tips anchor rounded distal finger pads. `handContactProfile.ts` defines the same dimensions and poses for physics and debug meshes (box half-extents, capsule radius and center-to-center length). Keep shape dimensions stable across poses: in loader 0.8.6 changing rigid-body definitions recreates the Bullet world. Convert dimensions by model scale independently of the rigid transforms.
- Physics wrapper order is `[model, controllers (2), hands (12), props (8)]`. Dildo 0–3, wand 4–6, wearable shell 7; the stand uses the same dildo, and the transmitter has no prop proxy. Sample the receiver on its wearer’s pre-Bullet skeleton using the displayed scale. The controller contact range starts at the original `sourceRigidBodyCount`; exclude synthetic pairs. Keep definitions immutable, park unused slots, re-arm outside dynamic bounds after a discontinuity. Verify dynamic bones or skinned vertices against a motor-off or empty-hand control with shipped Bullet.
- A pelvic socket is opt-in and actor-local. Use the real silicone outlet, the calibrated entrance crossing and the same arc for section, rail and stops. Reacquisition inside is not insertion. After pose evaluation route each dose once: admitted inside, verified exterior, or neither (consume without spray or deferred output). A slider or throttled HUD readout is not contact evidence. An input interruption cannot restart the motor on its own.
- Controller and hand providers must use the shared model visual-space mapping and WebXR-to-MMD coordinate conversion.
- Preserve the controller matrix scale normalization and the independent collider-radius/model-scale conversion. These are needed for scaled models and cloth contact.
- Physics wrappers cache immutable body definitions by array identity, matching the loader. Replace `rigidBodies` when definitions change. Copied buffers are per-wrapper scratch: preserve prefix copying and tail clearing on every step, and never retain them as historical snapshots. Controller contact counts must exclude synthetic-to-synthetic contacts (hidden colliders overlap at Y=-1000) and hidden/disposed models. See `docs/performance/xr-runtime-performance.md` for benchmarks and the native Bullet smoke check.
- Ordinary GLB/glTF environment meshes use bounding-sphere frustum culling via `prepareStageObject`; skinned/morph meshes remain conservative. PMX character culling remains disabled. Do not freeze the movable object root's matrices.
- Put routine model operations at the selected target. Right-controller B recalls the common menu; provide a backpack path to selecting hidden or occluded items. Keep advanced pages at a common panel position. Trigger release activates once even on a slow press. Ordinary hand contact with clothes must never select or translate the character. See `docs/gameplay/vr-controls.md`.

## Verification And Files

- When filtering sensitive material from the public README, edit only the affected examples, screenshots and links. Preserve the project badges and technical sections (stack, XR and physics, diagnostics, development and deployment). Keep private asset details and internal handoff notes off the front page.

- For completed product changes, finish the release for the user: after verification, merge, push normally, deploy the tested build to the existing production Pages project per `docs/deployment.md`, and verify the main domain. Report the live link instead of handing the user a release command. If a check or deployment fails, report the blocker. This routine does not authorize force pushes.

- Browser checks do not replace Quest hardware validation. For XR/physics changes, manually regress model scaling, cloth fall/contact, panel persistence, controller and hand collisions, controller contact counts, and haptics.
- `sample/` is ignored; model assets must never be committed. For loader, rig and garment changes, supplement deterministic fixtures with the user's local reference PMX when available. Confirm actual loading and a relevant measured behavior; keep identifying paths and captures out of the repository. `.gitattributes` expects LF text and treats `*.wasm` as binary.
- Update `docs/THIRD_PARTY_NOTICES.md` when changing bundled third-party versions.
