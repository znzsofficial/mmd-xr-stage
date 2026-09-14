# MMD XR Stage Agent Guide

## Project Shape

- Single-purpose WebGL + WebXR MMD showcase for Meta Quest. Prep page at `/` (`index.html` -> `src/main.tsx` -> `src/mmdVrShowcase/MmdVrPrepApp`), XR scene entered from there.
- `src/mmdVrShowcase/` owns the entire product surface: prep UI, XR session, scene, HUD, colliders, haptics, physics reseed.
- `src/xr/` owns XR detection, session creation (`createProductXrSession`), pending-session attachment, and quality axes. One XR store + session per product surface; never share instances.
- There is no desktop, no window manager, and no second product surface in this repository.

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

## MMD Loader And Assets

- The runtime is pinned to `@yohawing/three-mmd-loader@0.8.3`.
- Keep the matching Bullet files in `public/mmd/0.8.3/mmd_bullet.js` and `public/mmd/0.8.3/mmd_bullet.wasm`, and keep the path in `src/mmdVrShowcase/*` synchronized when versioning.
- Keep the loader entry in `pnpm-workspace.yaml` (`patchedDependencies`) and `patches/@yohawing__three-mmd-loader@0.8.3.patch`. The published package still lacks `debugPhysicsContactsForRigidBodyRange()`; the patch filters the native debug contact buffer by rigid-body range and is required for controller/hand contact diagnostics and haptics. The patch also carries a three r186 compat shim for the loader's experimental TSL self-shadow pass (degrades to no-op; see `docs/three-mmd-loader-maintenance.md`).
- Keep `patches/@pmndrs__xr@6.6.30.patch` alongside it: it fixes `@pmndrs/xr` input-source state cleanup (listener/map leak when a controller input source is replaced). `src/xr/xrInputLifecycle.test.ts` fails without it.
- When upgrading the loader, follow `docs/three-mmd-loader-maintenance.md`: verify upstream API coverage, update versioned assets and docs, run `pnpm install`, then rerun focused physics/haptics tests, the full suite, TypeScript, and the build. Do not remove the patch merely because the upstream version changed.
- The loader clone at `E:\WebProjects\three-mmd-loader` uses npm and `package-lock.json`; do not use pnpm there.

## XR And Physics Invariants

- MMD XR must request the optional `hand-tracking` feature when the session is created. This allows hand tracking to be enabled after entering XR; preserve `beginFromClick(init?)` initialization passthrough.
- `handTracking` is the persisted preference name and defaults to `true`. Do not reintroduce `handDetail`.
- Hand colliders use 12 fixed slots: each hand has a wrist and five fingertip colliders. Keep their provider mapping in `src/mmdVrShowcase/mmdVrHandColliders.ts` and `components/MmdVrHandColliders.tsx`.
- Physics wrapper order is `[model, controller colliders (2), hand colliders (12)]`: the controller wrapper is outermost and added first, with the hand wrapper inside it. Controller contact indexing starts at the original `sourceRigidBodyCount`; do not add the 12 hand slots to that offset. Forward contact diagnostics through every wrapper.
- Controller and hand providers must use the shared model visual-space mapping and WebXR-to-MMD coordinate conversion.
- Preserve the controller matrix scale normalization and the independent collider-radius/model-scale conversion. These are needed for scaled models and cloth contact.

## Verification And Files

- Browser checks do not replace Quest hardware validation. For XR/physics changes, manually regress model scaling, cloth fall/contact, panel persistence, controller and hand collisions, controller contact counts, and haptics.
- `sample/` is ignored; model assets must never be committed. `.gitattributes` expects LF text and treats `*.wasm` as binary.
- Update `docs/THIRD_PARTY_NOTICES.md` when changing bundled third-party versions.
