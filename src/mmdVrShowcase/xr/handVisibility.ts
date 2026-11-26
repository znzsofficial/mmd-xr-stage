import type { AppXrStore } from '../../xr/createAppXrStore';
import { HUD_RAY } from '../hud/hudPointer';
import { useMmdVrStore } from '../mmdVrStore';

/** Hiding a tracked hand hides its mesh, not its menu ray or touch target. */
export function bindHandVisibility(store: AppXrStore, rayPointer = HUD_RAY) {
  const apply = (model: boolean) => store.setHand({model,rayPointer,touchPointer:{hoverRadius:.16}});
  apply(useMmdVrStore.getState().prefs.handTracking);
  return useMmdVrStore.subscribe((s,prev) => {
    if (s.prefs.handTracking !== prev.prefs.handTracking) apply(s.prefs.handTracking);
  });
}
