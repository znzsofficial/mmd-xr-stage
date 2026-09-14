import { Suspense, lazy } from "react";
import { useMmdVrStore } from "./mmdVrStore";

const MmdVrScene = lazy(() => import("./MmdVrScene").then((m) => ({ default: m.MmdVrScene })));

/** Fullscreen XR shell after session requested from a user gesture. */
export function MmdVrOverlay() {
  const overlayOpen = useMmdVrStore((state) => state.overlayOpen);
  if (!overlayOpen) return null;
  return (
    <Suspense fallback={<div className="vr-desktop-overlay vr-desktop-loading" aria-busy="true" />}>
      <MmdVrScene />
    </Suspense>
  );
}
