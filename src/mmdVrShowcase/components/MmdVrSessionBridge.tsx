import { useCallback } from "react";
import type { WebGLRenderer } from "three";
import { AttachPendingXrSession, HeadsetHudGate, XrSessionSync } from "../../xr";
import {
  attachPendingMmdVrSessionToRenderer,
  endMmdVrSession,
  peekPendingMmdVrSession,
} from "../mmdVrSession";
import { useMmdVrStore } from "../mmdVrStore";

export function AttachPendingMmdVrSession() {
  const setPhase = useMmdVrStore((s) => s.setPhase);
  const failEnter = useMmdVrStore((s) => s.failEnter);

  const attach = useCallback(
    (gl: WebGLRenderer) =>
      attachPendingMmdVrSessionToRenderer(gl, useMmdVrStore.getState().prefs),
    [],
  );
  const peekPending = useCallback(() => peekPendingMmdVrSession(), []);
  const isOverlayOpen = useCallback(() => useMmdVrStore.getState().overlayOpen, []);
  const onActive = useCallback(() => setPhase("active"), [setPhase]);
  const onFail = useCallback((detail: string) => failEnter(detail), [failEnter]);
  const endSession = useCallback(() => {
    void endMmdVrSession();
  }, []);

  return (
    <AttachPendingXrSession
      attach={attach}
      peekPending={peekPending}
      isOverlayOpen={isOverlayOpen}
      onActive={onActive}
      onFail={onFail}
      endSession={endSession}
      logTag="mmdVr"
    />
  );
}

export function MmdVrSessionSync() {
  const setPhase = useMmdVrStore((state) => state.setPhase);
  const closeOverlay = useMmdVrStore((state) => state.closeOverlay);
  const onActive = useCallback(() => setPhase("active"), [setPhase]);
  const onSessionEnd = useCallback(() => closeOverlay(), [closeOverlay]);
  return <XrSessionSync onActive={onActive} onSessionEnd={onSessionEnd} />;
}

export function MmdVrHeadsetHudGate({ onHideHud }: { onHideHud: (hide: boolean) => void }) {
  return <HeadsetHudGate onHideHud={onHideHud} />;
}
