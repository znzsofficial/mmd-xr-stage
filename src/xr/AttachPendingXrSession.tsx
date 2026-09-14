import { useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { useEffect, useRef } from "react";
import type { WebGLRenderer } from "three";

export type AttachPendingXrSessionProps = {
  /** Bind pending session to this GL (prefs read inside). */
  attach: (gl: WebGLRenderer) => Promise<boolean>;
  peekPending: () => XRSession | null;
  isOverlayOpen: () => boolean;
  onActive: () => void;
  onFail: (detail: string) => void;
  endSession: () => void | Promise<void>;
  logTag: string;
};

/**
 * Click path already called requestSession(); bind once gl is ready.
 * Retries under Strict Mode / slow first WebGL init (Quest first-open hang).
 */
export function AttachPendingXrSession({
  attach,
  peekPending,
  isOverlayOpen,
  onActive,
  onFail,
  endSession,
  logTag,
}: AttachPendingXrSessionProps) {
  const gl = useThree((s) => s.gl);
  const attemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const attemptId = ++attemptRef.current;

    async function tryAttach(round: number): Promise<void> {
      if (cancelled || attemptId !== attemptRef.current) return;

      try {
        const attached = await attach(gl);
        if (cancelled || attemptId !== attemptRef.current) return;

        if (attached) {
          onActive();
          return;
        }

        if (round < 40 && isOverlayOpen()) {
          timer = window.setTimeout(() => {
            void tryAttach(round + 1);
          }, 40 + Math.min(round * 15, 200));
          return;
        }

        if (peekPending()) {
          console.warn(`[${logTag}] setSession did not present after retries`);
        }
      } catch (err) {
        console.error(`[${logTag}] setSession failed`, err);
        if (cancelled || attemptId !== attemptRef.current) return;

        if (round < 5 && peekPending() && isOverlayOpen()) {
          timer = window.setTimeout(() => {
            void tryAttach(round + 1);
          }, 150);
          return;
        }

        const detail = err instanceof Error ? err.message : "set_session_failed";
        onFail(detail);
        void endSession();
      }
    }

    void tryAttach(0);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [attach, endSession, gl, isOverlayOpen, logTag, onActive, onFail, peekPending]);

  return null;
}

export function XrSessionSync({
  onActive,
  onSessionEnd,
}: {
  onActive: () => void;
  onSessionEnd: () => void;
}) {
  const session = useXR((state) => state.session);

  useEffect(() => {
    if (!session) return;
    onActive();
    const onEnd = () => {
      onSessionEnd();
    };
    session.addEventListener("end", onEnd);
    return () => session.removeEventListener("end", onEnd);
  }, [onActive, onSessionEnd, session]);

  return null;
}

/** Hide 2D exit HUD only when session mode is explicitly immersive. */
export function HeadsetHudGate({ onHideHud }: { onHideHud: (hide: boolean) => void }) {
  const session = useXR((state) => state.session);
  useEffect(() => {
    if (!session) {
      onHideHud(false);
      return;
    }
    const mode = (session as XRSession & { mode?: string }).mode;
    onHideHud(mode === "immersive-vr" || mode === "immersive-ar");
  }, [onHideHud, session]);
  return null;
}
