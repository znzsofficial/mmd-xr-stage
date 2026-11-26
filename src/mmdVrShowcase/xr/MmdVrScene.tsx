import { Canvas } from "@react-three/fiber";
import { XR } from "@react-three/xr";
import { useRef, useState } from "react";
import { useLanguageStore } from "../../languageStore";
import {
  AttachPendingMmdVrSession,
  MmdVrHeadsetHudGate,
} from "./MmdVrSessionBridge";
import { MmdVrGameRoom } from './MmdVrGameRoom';
import { endMmdVrSession, getMmdVrSessionSnapshot, mmdVrXrStore } from "./mmdVrSession";
import { getMmdVrRenderProfile } from "../settings/mmdVrQuality";
import { awaitingFreshXrFrame, useMmdVrStore } from "../mmdVrStore";
import { describeRenderRequest } from "../diagnostics/renderDiagnostics";
import { MmdVrDiagnostics } from "../diagnostics/MmdVrDiagnostics";
import { stageHudVars } from '../pelvic/palette';

export function MmdVrScene() {
  const closeOverlay = useMmdVrStore((state) => state.closeOverlay);
  const t = useLanguageStore((state) => state.t);
  const mmdPrefs = useMmdVrStore((state) => state.prefs);
  const mountRoom = useMmdVrStore(s => s.overlayOpen && (s.phase === 'active' || (s.phase === 'entering' && !awaitingFreshXrFrame(s))));
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
      style={stageHudVars}
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
          {mountRoom && <MmdVrGameRoom onExit={exitVr} busy={exiting}/>}
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
