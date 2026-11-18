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
import { MmdVrThemeProvider } from "./mmdVrTheme";
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
    <MmdVrThemeProvider>
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
              playLabel={t("settingsMmdVrPlay")}
              pauseLabel={t("settingsMmdVrPause")}
              loopOnLabel={t("settingsMmdVrLoopOn")}
              loopOffLabel={t("settingsMmdVrLoopOff")}
              resetLabel={t("settingsMmdVrResetView")}
              exitLabel={t("settingsVrDesktopExit")}
              emptyHint={t("settingsMmdVrEmptyNoAssets")}
              hideLabel={t("settingsMmdVrHideModel")}
              showLabel={t("settingsMmdVrShowModel")}
              placeOnLabel={t("settingsMmdVrPlaceOn")}
              placeOffLabel={t("settingsMmdVrPlaceOff")}
              placeHint={t("settingsMmdVrPlaceHint")}
              lightStageLabel={t("settingsMmdVrLightStage")}
              lightSoftLabel={t("settingsMmdVrLightSoft")}
              lightContrastLabel={t("settingsMmdVrLightContrast")}
              lightDaylightLabel={t("settingsMmdVrLightDaylight")}
              lightWarmLabel={t("settingsMmdVrLightWarm")}
              lightRimLabel={t("settingsMmdVrLightRim")}
              shadowsLabel={t("settingsMmdVrShadows")}
              gridLabel={t("settingsMmdVrGrid")}
              scaleLabel={t("settingsMmdVrModelScale")}
              rotateLeftLabel={t("settingsMmdVrRotateLeft")}
              rotateRightLabel={t("settingsMmdVrRotateRight")}
              heightLabel={t("settingsMmdVrUserHeight")}
              viewDistanceLabel={t("settingsMmdVrViewDistance")}
              resetValueLabel={t("settingsMmdVrValueReset")}
              panelHideLabel={t("settingsMmdVrPanelHide")}
              panelShowLabel={t("settingsMmdVrPanelShow")}
              panelDragLabel={t("settingsMmdVrPanelDrag")}
              panelFollowOnLabel={t("settingsMmdVrPanelFollowOn")}
              panelFollowOffLabel={t("settingsMmdVrPanelFollowOff")}
              fpsOnLabel={t("settingsMmdVrFpsOn")}
              fpsOffLabel={t("settingsMmdVrFpsOff")}
              physicsOnLabel={t("settingsMmdVrPhysicsOn")}
              physicsOffLabel={t("settingsMmdVrPhysicsOff")}
              physicsDebugOnLabel={t("settingsMmdVrPhysicsDebugOn")}
              physicsDebugOffLabel={t("settingsMmdVrPhysicsDebugOff")}
              physicsSettingsLabel={t("settingsMmdVrPhysicsSettings")}
              visualSettingsLabel={t("settingsMmdVrVisualSettings")}
              skyOnLabel={t("settingsMmdVrSkyOn")}
              skyOffLabel={t("settingsMmdVrSkyOff")}
              fogOnLabel={t("settingsMmdVrFogOn")}
              fogOffLabel={t("settingsMmdVrFogOff")}
              rimLightOnLabel={t("settingsMmdVrRimLightOn")}
              rimLightOffLabel={t("settingsMmdVrRimLightOff")}
              lightPoolOnLabel={t("settingsMmdVrLightPoolOn")}
              lightPoolOffLabel={t("settingsMmdVrLightPoolOff")}
              handTrackingOnLabel={t("settingsMmdVrHandTrackingOn")}
              handTrackingOffLabel={t("settingsMmdVrHandTrackingOff")}
              physicsCollisionOnLabel={t("settingsMmdVrPhysicsCollisionOn")}
              physicsCollisionOffLabel={t("settingsMmdVrPhysicsCollisionOff")}
              physicsSelfCollisionOnLabel={t("settingsMmdVrPhysicsSelfCollisionOn")}
              physicsSelfCollisionOffLabel={t("settingsMmdVrPhysicsSelfCollisionOff")}
              physicsRadiusLabel={t("settingsMmdVrPhysicsRadius")}
              physicsQualityLabels={[
                t("settingsMmdVrPhysicsQualityLow"),
                t("settingsMmdVrPhysicsQualityMedium"),
                t("settingsMmdVrPhysicsQualityHigh"),
              ]}
              physicsHapticLevelLabels={[
                t("settingsMmdVrPhysicsHapticsOff"),
                t("settingsMmdVrPhysicsHapticsLow"),
                t("settingsMmdVrPhysicsHapticsNormal"),
              ]}
              physicsBoneFeedbackLabel={t("settingsMmdVrPhysicsBoneFeedback")}
              physicsBoneFeedbackLabels={[
                t("settingsMmdVrPhysicsBoneFeedbackSoft"),
                t("settingsMmdVrPhysicsBoneFeedbackNormal"),
                t("settingsMmdVrPhysicsBoneFeedbackHard"),
              ]}
              physicsColliderFrictionLabel={t("settingsMmdVrPhysicsColliderFriction")}
              physicsColliderFrictionLabels={[
                t("settingsMmdVrPhysicsColliderFrictionLow"),
                t("settingsMmdVrPhysicsColliderFrictionMedium"),
                t("settingsMmdVrPhysicsColliderFrictionHigh"),
              ]}
              physicsColliderRestitutionLabel={t("settingsMmdVrPhysicsColliderRestitution")}
              physicsColliderRestitutionLabels={[
                t("settingsMmdVrPhysicsColliderRestitutionNone"),
                t("settingsMmdVrPhysicsColliderRestitutionLow"),
                t("settingsMmdVrPhysicsColliderRestitutionHigh"),
              ]}
              resetPhysicsLabel={t("settingsMmdVrPhysicsReset")}
              snapTurnLabel={t("settingsMmdVrSnapTurn")}
              exposureLabel={t("settingsMmdVrExposure")}
              removeLabel={t("settingsMmdVrRemoveModel")}
              materialsLabel={t("settingsMmdVrMaterials")}
              materialOpacityLabel={t("settingsMmdVrMaterialOpacity")}
              materialRoughnessLabel={t("settingsMmdVrMaterialRoughness")}
              materialMetallicLabel={t("settingsMmdVrMaterialMetallic")}
              materialEmissionLabel={t("settingsMmdVrMaterialEmission")}
              walkLabels={[
                t("settingsMmdVrWalkSlow"),
                t("settingsMmdVrWalkNormal"),
                t("settingsMmdVrWalkFast"),
              ]}
              walkSpeedLabel={t("settingsMmdVrWalkSpeed")}
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
    </MmdVrThemeProvider>
  );
}
