import { formatXrSessionError, getXrDiagnostics, getXrSystem } from "./xrDetect";
import { waitForXrOperation } from "./waitForXrOperation";

export type ImmersiveEnterResult = "entered" | "failed";

export type RequestImmersiveEnterOpts = {
  /** Self already entering/active/open. */
  isSelfBusy: () => boolean;
  setEntering: () => void;
  setLastError: (value: string | null) => void;
  openOverlay: () => void;
  beginSessionFromClick: () => Promise<XRSession>;
  waitForPresentation: (signal?: AbortSignal) => Promise<XRSession>;
  signal?: AbortSignal;
  describeStartup?: () => string;
  markEntered: () => void;
  failEnter: (detail: string) => void;
  onFailCleanup?: () => void;
  /** Report an unavailable device/context without starting or cleaning up a session. */
  onPreflightError: (message: string) => void;
  needHttpsMessage: string;
  noXrMessage: string;
  logTag: string;
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
    setEntering,
    setLastError,
    openOverlay,
    beginSessionFromClick,
    markEntered,
    failEnter,
    onFailCleanup,
    onPreflightError,
    needHttpsMessage,
    noXrMessage,
    logTag,
  } = opts;

  if (isSelfBusy()) {
    return Promise.resolve("failed");
  }

  const diag = getXrDiagnostics();
  if (!diag.secure || !getXrSystem()) {
    setLastError(diag.summary);
    onPreflightError(diag.secure ? noXrMessage : needHttpsMessage);
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
  return waitForXrOperation(session, { signal: opts.signal })
    .then(() => {
      if (opts.isCancelled?.()) throw new DOMException("XR entry cancelled", "AbortError");
      return waitForXrOperation(opts.waitForPresentation(opts.signal), {
        signal: opts.signal,
        timeoutMs: 20_000,
        timeoutMessage: "XR renderer did not deliver its first frame",
      });
    })
    .then(() => {
      if (opts.isCancelled?.()) return "failed" as const;
      markEntered();
      return "entered" as const;
    })
    .catch((err: unknown) => {
      if (opts.isCancelled?.()) return "failed" as const;
      const detail = `${formatXrSessionError(err)}${opts.describeStartup ? ` (${opts.describeStartup()})` : ""}`;
      console.error(`[${logTag}] XR startup failed`, err);
      onFailCleanup?.();
      failEnter(detail);
      return "failed" as const;
    });
}
