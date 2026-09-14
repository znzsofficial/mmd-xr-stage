import { formatXrSessionError, getXrDiagnostics, getXrSystem } from "./xrDetect";

export type ImmersiveEnterResult = "entered" | "failed";

export type RequestImmersiveEnterOpts = {
  /** Self already entering/active/open. */
  isSelfBusy: () => boolean;
  /** Other product surface blocking enter (message for notify). */
  getBlockerMessage?: () => string | null;
  setEntering: () => void;
  setLastError: (value: string | null) => void;
  openOverlay: () => void;
  preloadScene: () => void;
  beginSessionFromClick: () => Promise<XRSession>;
  markEntered: () => void;
  failEnter: (detail: string) => void;
  onSuccess?: () => void;
  onFailCleanup?: () => void;
  notify: (message: string, type?: "error" | "warning") => void;
  needHttpsMessage: string;
  noXrMessage: string;
  logTag: string;
  /** Optional capability refresh after hard fails. */
  refreshCapability?: () => void;
};

/**
 * Shared immersive enter path.
 * Call only from a button onClick (user activation).
 * requestSession is the first browser async on this stack; overlay opens immediately.
 */
export function requestImmersiveEnter(opts: RequestImmersiveEnterOpts): Promise<ImmersiveEnterResult> {
  const {
    isSelfBusy,
    getBlockerMessage,
    setEntering,
    setLastError,
    openOverlay,
    preloadScene,
    beginSessionFromClick,
    markEntered,
    failEnter,
    onSuccess,
    onFailCleanup,
    notify,
    needHttpsMessage,
    noXrMessage,
    logTag,
    refreshCapability,
  } = opts;

  if (isSelfBusy()) {
    return Promise.resolve("failed");
  }

  const blocker = getBlockerMessage?.() ?? null;
  if (blocker) {
    setLastError("blocked");
    notify(blocker, "warning");
    return Promise.resolve("failed");
  }

  const diag = getXrDiagnostics();
  if (!diag.secure) {
    setLastError(diag.summary);
    refreshCapability?.();
    notify(needHttpsMessage, "warning");
    return Promise.resolve("failed");
  }

  if (!getXrSystem()) {
    setLastError(diag.summary);
    refreshCapability?.();
    notify(noXrMessage, "warning");
    return Promise.resolve("failed");
  }

  setEntering();
  setLastError(null);
  openOverlay();
  void preloadScene();

  return beginSessionFromClick()
    .then(() => {
      onSuccess?.();
      markEntered();
      return "entered" as const;
    })
    .catch((err: unknown) => {
      const detail = formatXrSessionError(err);
      console.error(`[${logTag}] requestSession failed`, err);
      onFailCleanup?.();
      failEnter(detail);
      notify(detail.length > 160 ? `${detail.slice(0, 157)}…` : detail, "error");
      refreshCapability?.();
      return "failed" as const;
    });
}
