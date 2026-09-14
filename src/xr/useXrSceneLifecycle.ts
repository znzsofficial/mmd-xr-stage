import { useEffect, useRef, type MutableRefObject } from "react";

export type XrSceneLifecycleOpts = {
  /** True while the product overlay should keep the session alive across remounts. */
  isOverlayOpen: () => boolean;
  shouldEndSession: () => boolean;
  endSession: () => Promise<void>;
  closeOverlay: () => void;
  graceMs?: number;
  /** Extra cleanup when the scene unmounts (timers, etc.). */
  onCleanup?: () => void;
};

/**
 * Per-product mount guard factory so Strict Mode remount does not end XR mid-load.
 * Create one guard module-side per Scene file.
 */
export function createXrSceneMountGuard() {
  let mountCount = 0;

  function useXrSceneLifecycle(opts: XrSceneLifecycleOpts): {
    mountedRef: MutableRefObject<boolean>;
  } {
    const mountedRef = useRef(true);
    const optsRef = useRef(opts);
    optsRef.current = opts;

    useEffect(() => {
      mountedRef.current = true;
      mountCount += 1;
      return () => {
        mountedRef.current = false;
        optsRef.current.onCleanup?.();
        mountCount -= 1;
        const grace = optsRef.current.graceMs ?? 200;
        window.setTimeout(() => {
          if (mountCount !== 0) return;
          if (optsRef.current.isOverlayOpen()) return;
          if (optsRef.current.shouldEndSession()) {
            void optsRef.current.endSession();
          }
        }, grace);
      };
    }, []);

    return { mountedRef };
  }

  return { useXrSceneLifecycle };
}
