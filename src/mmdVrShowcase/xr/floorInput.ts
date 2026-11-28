import { createContext } from 'react';

type Interruption = 'viewer-pose-lost' | 'visibility-lost' | 'visible-frame-gap';
type Listener = (reason: Interruption) => void;
type RoomInput = { tracked(): boolean; subscribe(listener: Listener): () => void };

// Only the externally advanced WebGPU root supplies this. In particular, a
// renderer reused for a later entry never reuses the previous room's signal.
export const FloorInputContext = createContext<RoomInput | null>(null);

export function bindFloorInput(session: XRSession, onInterrupt: Listener) {
  const listeners = new Set<Listener>();
  let previous: number | undefined, disposed = false;
  function interrupt(reason: Interruption) {
    if (disposed) return;
    if (reason !== 'visible-frame-gap') previous = undefined;
    for (const listener of listeners) listener(reason);
    onInterrupt(reason);
  }
  const blur = () => interrupt('visibility-lost');
  const visibility = () => { if (session.visibilityState !== 'visible') blur(); };
  const pageVisibility = () => { if (document.hidden) blur(); };
  session.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', pageVisibility);
  const room: RoomInput = {
    tracked: () => !disposed && previous !== undefined && session.visibilityState === 'visible' && !document.hidden,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  return { room,
    // null skips Fiber entirely; zero still advances the tracked room, without
    // feeding a suspension interval to its movement, grips or physics clock.
    frame(time: number, hasViews: boolean) {
      if (disposed) return null;
      if (session.visibilityState !== 'visible' || document.hidden) { blur(); return null; }
      if (!hasViews) { interrupt('viewer-pose-lost'); return null; }
      const delta = previous === undefined ? 0 : (time - previous) / 1000;
      previous = time;
      if (delta < 0 || delta > .25) { interrupt('visible-frame-gap'); return 0; }
      return delta;
    },
    dispose() {
      disposed = true; listeners.clear();
      session.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', pageVisibility);
    },
  };
}
