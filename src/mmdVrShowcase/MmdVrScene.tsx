import { Canvas } from "@react-three/fiber";
import { XR } from "@react-three/xr";
import { useRef, useState } from "react";
import { useLanguageStore } from "../languageStore";
import {
  AttachPendingMmdVrSession,
  MmdVrHeadsetHudGate,
} from "./components/MmdVrSessionBridge";
import { MmdVrPlayerRig } from "./components/MmdVrPlayerRig";
import { MmdVrStageContent } from "./components/MmdVrStage";
import { endMmdVrSession, getMmdVrSessionSnapshot, mmdVrXrStore } from "./mmdVrSession";
import { getMmdVrRenderProfile } from "./mmdVrQuality";
import { useMmdVrStore } from "./mmdVrStore";
import { describeRenderRequest } from "./renderDiagnostics";
import { MmdVrDiagnostics } from "./components/MmdVrDiagnostics";
import { BackpackPlacement } from "./components/BackpackPlacement";
import { BackpackWorldTools } from "./components/BackpackWorldTools";
import { StagePlay } from './play/HeldPlay';

export function MmdVrScene() {
  const closeOverlay = useMmdVrStore((state) => state.closeOverlay);
  const t = useLanguageStore((state) => state.t);
  const mmdPrefs = useMmdVrStore((state) => state.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const [requested] = useState(() => describeRenderRequest(useMmdVrStore.getState().prefs));
  const [exiting, setExiting] = useState(false);
  const [hideExitHud, setHideExitHud] = useState(false);
  const exitingRef = useRef(false);
  const [entryEpoch] = useState(() => useMmdVrStore.getState().entryEpoch);
  const [generation] = useState(() => getMmdVrSessionSnapshot().generation);

  function exitVr() {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    if (useMmdVrStore.getState().entryEpoch === entryEpoch) closeOverlay();
    void endMmdVrSession(generation);
  }

  return (
    <div
      className="xr-stage-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("settingsMmdVrShowcase")}
    >
      <Canvas
        className="xr-stage-canvas"
        gl={{
          antialias: profile.antialias,
          powerPreference: "high-performance",
        }}
        shadows={profile.shadows}
        camera={{ position: [0, 1.5, 2.8], fov: 70, near: 0.05, far: mmdPrefs.viewDistance }}
        dpr={profile.dpr}
        frameloop="always"
      >
        <XR store={mmdVrXrStore}>
          <MmdVrDiagnostics requested={requested} />
          <AttachPendingMmdVrSession />
          <MmdVrHeadsetHudGate onHideHud={setHideExitHud} />
          <MmdVrPlayerRig
            onExit={exitVr}
            busy={exiting}
          />
          <MmdVrStageContent />
          <BackpackPlacement />
          <BackpackWorldTools />
          <StagePlay />
        </XR>
      </Canvas>
      {!hideExitHud ? (
        <div className="xr-stage-hud">
          <button type="button" className="xr-stage-exit" onClick={exitVr} disabled={exiting}>
            {t("settingsVrDesktopExit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
