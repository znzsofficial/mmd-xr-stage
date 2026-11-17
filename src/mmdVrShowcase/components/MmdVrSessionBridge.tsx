import { useCallback, useState } from "react";
import type { WebGLRenderer } from "three";
import { AttachPendingXrSession, HeadsetHudGate } from "../../xr";
import { attachPendingMmdVrSessionToRenderer, endMmdVrSession, getMmdVrSessionSnapshot, markMmdVrXrFrame } from "../mmdVrSession";
import { useMmdVrStore } from "../mmdVrStore";

export function AttachPendingMmdVrSession() {
  const [entryEpoch] = useState(() => useMmdVrStore.getState().entryEpoch);
  const [generation] = useState(() => getMmdVrSessionSnapshot().generation);
  const isCurrent = useCallback(() => {
    const state = useMmdVrStore.getState();
    const session = getMmdVrSessionSnapshot();
    return state.overlayOpen && state.entryEpoch === entryEpoch && session.generation === generation && session.phase !== "idle";
  }, [entryEpoch, generation]);
  const attach = useCallback((gl: WebGLRenderer, signal: AbortSignal) =>
    attachPendingMmdVrSessionToRenderer(gl, useMmdVrStore.getState().prefs, signal), []);
  const onFail = useCallback((detail: string) => {
    if (!isCurrent()) return;
    void endMmdVrSession(generation);
    useMmdVrStore.getState().failEnter(detail);
  }, [generation, isCurrent]);

  return <AttachPendingXrSession attach={attach} markFrame={markMmdVrXrFrame} isCurrent={isCurrent} onFail={onFail} />;
}

export function MmdVrHeadsetHudGate({ onHideHud }: { onHideHud: (hide: boolean) => void }) {
  return <HeadsetHudGate onHideHud={onHideHud} />;
}
