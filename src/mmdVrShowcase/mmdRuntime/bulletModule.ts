import type { PhysicsSwitchWork } from '../physicsSwitchWork';

// Page-wide code/WASM instance only. Each explicit enable still creates its
// own backend and owns its world. Never put stage, model or File references here.
async function load() {
  const { loadCustomBulletMmdModule, createCustomBulletMmdPhysicsBackend } = await import('@yohawing/three-mmd-loader/physics');
  const scriptUrl = new URL('mmd/0.8.6/mmd_bullet.js', window.location.origin + (import.meta.env.BASE_URL || '/'));
  const module = await loadCustomBulletMmdModule({ scriptUrl: scriptUrl.href, timeoutMs: 30_000 });
  return { module, createCustomBulletMmdPhysicsBackend };
}
let cached: ReturnType<typeof load> | undefined;
let state: NonNullable<PhysicsSwitchWork['moduleAtFirstRequest']> = 'cold';

function start(warm: boolean) {
  state = warm ? 'warming' : 'demand-reuse';
  cached = load().then(result => {
    if (warm) state = 'warmed';
    return result;
  }, error => {
    cached = undefined;
    state = warm ? 'warm-failed' : 'cold';
    throw error;
  });
  return cached;
}

export function getBulletModule(work?: PhysicsSwitchWork) {
  if (work) work.moduleAtFirstRequest ??= state;
  // A real user request joining a speculative failure gets its own attempt.
  if (state === 'warming') return cached!.catch(() => cached ?? start(false));
  return cached ?? start(false);
}

/** Run only if the browser actually offers idle time; don't force a load on a
 * busy XR frame or in browsers without idle scheduling. No UI or world on completion. */
export function scheduleBulletModuleWarm(eligible: () => boolean) {
  if (state !== 'cold' || typeof window.requestIdleCallback !== 'function') return;
  const id = window.requestIdleCallback(() => {
    if (state === 'cold' && eligible()) void start(true).catch(() => {});
  });
  return () => window.cancelIdleCallback(id);
}
