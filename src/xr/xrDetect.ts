export function getXrSystem(): XRSystem | null {
  try {
    return (navigator as Navigator & { xr?: XRSystem | null }).xr ?? null;
  } catch {
    return null;
  }
}

export type XrDiagnostics = {
  secure: boolean;
  hasXr: boolean;
  protocol: string;
  host: string;
  summary: string;
};

/** Snapshot for Settings / notifications (Quest has no console). */
export function getXrDiagnostics(): XrDiagnostics {
  const secure =
    typeof (globalThis as { isSecureContext?: boolean }).isSecureContext === "boolean"
      ? Boolean((globalThis as { isSecureContext?: boolean }).isSecureContext)
      : typeof window !== "undefined"
        ? window.isSecureContext
        : false;
  const hasXr = Boolean(getXrSystem());
  const protocol = typeof location !== "undefined" ? location.protocol : "?";
  const host = typeof location !== "undefined" ? location.host : "?";
  return {
    secure,
    hasXr,
    protocol,
    host,
    summary: `secure=${secure} xr=${hasXr} ${protocol}//${host}`,
  };
}

/**
 * Minimal init for Meta Quest Browser.
 * `handTracking` requests the `hand-tracking` optional feature so the app can
 * receive finger joints; it is harmless when OS hand tracking is off.
 */
export function buildQuestVrSessionInit(opts: { handTracking?: boolean } = {}): XRSessionInit {
  return {
    requiredFeatures: ["local-floor"],
    optionalFeatures: [
      "bounded-floor",
      // Finger joint data is only exposed once this feature is granted.
      ...(opts.handTracking ? (["hand-tracking"] as const) : []),
    ],
  };
}

export function formatXrSessionError(err: unknown, fallback = "requestSession failed"): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "Error";
  return `${name}: ${message || fallback} · ${getXrDiagnostics().summary}`;
}
