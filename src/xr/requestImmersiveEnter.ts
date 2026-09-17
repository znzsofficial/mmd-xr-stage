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
  preloadScene: () => void | Promise<unknown>;
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
  isCancelled?: () => boolean;
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
  // Request synchronously while the click still carries user activation.
  let session: Promise<XRSession>;
  try {
    session = beginSessionFromClick();
  } catch (error) {
    session = Promise.reject(error);
  }
  const scene = Promise.resolve().then(preloadScene);

  return Promise.all([session, scene])
    .then(() => {
      if (opts.isCancelled?.()) return "failed" as const;
      onSuccess?.();
      markEntered();
      return "entered" as const;
    })
    .catch((err: unknown) => {
      if (opts.isCancelled?.()) return "failed" as const;
      const detail = formatXrSessionError(err);
      console.error(`[${logTag}] requestSession failed`, err);
      onFailCleanup?.();
      failEnter(detail);
      notify(detail.length > 160 ? `${detail.slice(0, 157)}…` : detail, "error");
      refreshCapability?.();
      return "failed" as const;
    });
}
