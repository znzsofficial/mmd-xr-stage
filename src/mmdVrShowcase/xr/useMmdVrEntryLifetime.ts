import { useEffect, useRef } from "react";
import { endMmdVrSession, getMmdVrSessionSnapshot } from "./mmdVrSession";
import { useMmdVrStore } from "../mmdVrStore";

export function useMmdVrEntryLifetime() {
  const effectEpoch = useRef(0);
  useEffect(() => {
    const epoch = ++effectEpoch.current;
    const entryEpoch = useMmdVrStore.getState().entryEpoch;
    const generation = getMmdVrSessionSnapshot().generation;
    return () => {
      queueMicrotask(() => {
        if (effectEpoch.current !== epoch) return;
        void endMmdVrSession(generation);
        const state = useMmdVrStore.getState();
        if (state.overlayOpen && state.entryEpoch === entryEpoch) state.closeOverlay();
      });
    };
  }, []);
}
