import type { PhysicsSwitchWork } from '../diagnostics/physicsSwitchWork';
import {bulletScriptPath} from '../../mmdImport/bulletAsset';

// Page-wide code/WASM instance only. Each explicit enable still creates its
// own backend and owns its world. Never put stage, model or File references here.
async function load() {
  const { loadCustomBulletMmdModule, createCustomBulletMmdPhysicsBackend } = await import('@yohawing/three-mmd-loader/physics');
  const scriptUrl = new URL(bulletScriptPath, window.location.origin + (import.meta.env.BASE_URL || '/'));
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

/** The ready-frame caller only schedules work. Immersive rendering can
 * starve idle callbacks; a separate task gives the module a second way in. */
export function scheduleBulletModuleWarm(eligible: () => boolean | 'busy') {
  if (state !== 'cold') return;
  let cancelled = false;
  let idle: number | undefined;
  let timer: number;
  function disarm() {
    if (idle !== undefined) window.cancelIdleCallback(idle);
    idle = undefined;
    window.clearTimeout(timer);
  }
  function attempt() {
    disarm();
    if (cancelled || state !== 'cold') return;
    const ready = eligible();
    if (ready === 'busy') timer = window.setTimeout(attempt, 1000);
    else if (ready) void start(true).catch(() => {});
  }
  timer = window.setTimeout(attempt, 1000);
  idle = window.requestIdleCallback?.(attempt);
  return () => { cancelled = true; disarm(); };
}
