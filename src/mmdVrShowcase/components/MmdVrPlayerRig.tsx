import { useFrame } from "@react-three/fiber";
import { useXRControllerLocomotion, useXRInputSourceState, XROrigin } from "@react-three/xr";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import {
  MMD_VR_HEIGHT_OFFSET_MAX,
  MMD_VR_HEIGHT_OFFSET_MIN,
  normalizeMmdVrHeightOffset,
} from "../mmdVrAdjustments";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore } from "../mmdVrStore";
import { MmdVrControlBar } from "./MmdVrHud";
import { MmdVrControllerColliders } from "./MmdVrControllerColliders";
import { MmdVrHandColliders } from "./MmdVrHandColliders";

/**
 * Smooth walk + snap turn. viewEpoch zeros origin (reset view).
 */
export function MmdVrPlayerRig({
  playLabel,
  pauseLabel,
  loopOnLabel,
  loopOffLabel,
  resetLabel,
  exitLabel,
  emptyHint,
  hideLabel,
  showLabel,
  placeOnLabel,
  placeOffLabel,
  placeHint,
  lightStageLabel,
  lightSoftLabel,
  lightContrastLabel,
  lightDaylightLabel,
  lightWarmLabel,
  lightRimLabel,
  shadowsLabel,
  gridLabel,
  scaleLabel,
  rotateLeftLabel,
  rotateRightLabel,
  heightLabel,
  viewDistanceLabel,
  resetValueLabel,
  panelHideLabel,
  panelShowLabel,
  panelDragLabel,
  panelFollowOnLabel,
  panelFollowOffLabel,
  fpsOnLabel,
  fpsOffLabel,
  physicsOnLabel,
  physicsOffLabel,
  physicsDebugOnLabel,
  physicsDebugOffLabel,
  physicsSettingsLabel,
  visualSettingsLabel,
  skyOnLabel,
  skyOffLabel,
  fogOnLabel,
  fogOffLabel,
  rimLightOnLabel,
  rimLightOffLabel,
  lightPoolOnLabel,
  lightPoolOffLabel,
  handTrackingOnLabel,
  handTrackingOffLabel,
  physicsCollisionOnLabel,
  physicsCollisionOffLabel,
  physicsSelfCollisionOnLabel,
  physicsSelfCollisionOffLabel,
  physicsRadiusLabel,
  physicsQualityLabels,
  physicsHapticLevelLabels,
  physicsBoneFeedbackLabel,
  physicsBoneFeedbackLabels,
  physicsColliderFrictionLabel,
  physicsColliderFrictionLabels,
  physicsColliderRestitutionLabel,
  physicsColliderRestitutionLabels,
  resetPhysicsLabel,
  snapTurnLabel,
  exposureLabel,
  removeLabel,
  materialsLabel,
  materialOpacityLabel,
  materialRoughnessLabel,
  materialMetallicLabel,
  materialEmissionLabel,
  walkLabels,
  walkSpeedLabel,
  onExit,
  busy,
}: {
  playLabel: string;
  pauseLabel: string;
  loopOnLabel: string;
  loopOffLabel: string;
  resetLabel: string;
  exitLabel: string;
  emptyHint: string;
  hideLabel: string;
  showLabel: string;
  placeOnLabel: string;
  placeOffLabel: string;
  placeHint: string;
  lightStageLabel: string;
  lightSoftLabel: string;
  lightContrastLabel: string;
  lightDaylightLabel: string;
  lightWarmLabel: string;
  lightRimLabel: string;
  shadowsLabel: string;
  gridLabel: string;
  scaleLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  heightLabel: string;
  viewDistanceLabel: string;
  resetValueLabel: string;
  panelHideLabel: string;
  panelShowLabel: string;
  panelDragLabel: string;
  panelFollowOnLabel: string;
  panelFollowOffLabel: string;
  fpsOnLabel: string;
  fpsOffLabel: string;
  physicsOnLabel: string;
  physicsOffLabel: string;
  physicsDebugOnLabel: string;
  physicsDebugOffLabel: string;
  physicsSettingsLabel: string;
  visualSettingsLabel: string;
  skyOnLabel: string;
  skyOffLabel: string;
  fogOnLabel: string;
  fogOffLabel: string;
  rimLightOnLabel: string;
  rimLightOffLabel: string;
  lightPoolOnLabel: string;
  lightPoolOffLabel: string;
  handTrackingOnLabel: string;
  handTrackingOffLabel: string;
  physicsCollisionOnLabel: string;
  physicsCollisionOffLabel: string;
  physicsSelfCollisionOnLabel: string;
  physicsSelfCollisionOffLabel: string;
  physicsRadiusLabel: string;
  physicsQualityLabels: [string, string, string];
  physicsHapticLevelLabels: [string, string, string];
  physicsBoneFeedbackLabel: string;
  physicsBoneFeedbackLabels: [string, string, string];
  physicsColliderFrictionLabel: string;
  physicsColliderFrictionLabels: [string, string, string];
  physicsColliderRestitutionLabel: string;
  physicsColliderRestitutionLabels: [string, string, string];
  resetPhysicsLabel: string;
  snapTurnLabel: string;
  exposureLabel: string;
  removeLabel: string;
  materialsLabel: string;
  materialOpacityLabel: string;
  materialRoughnessLabel: string;
  materialMetallicLabel: string;
  materialEmissionLabel: string;
  walkLabels: [string, string, string];
  walkSpeedLabel: string;
  onExit: () => void;
  busy: boolean;
}) {
  const originRef = useRef<THREE.Group>(null);
  const viewEpoch = useMmdVrStore((s) => s.viewEpoch);
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const speed = getMmdVrRenderProfile(mmdPrefs).walkSpeed;
  const heightOffset = mmdPrefs.heightOffset;
  const [activePanelInteractions, setActivePanelInteractions] = useState(0);
  const [snapTurnReady, setSnapTurnReady] = useState(true);
  const panelDragging = activePanelInteractions > 0;
  const setPanelDragging = useCallback((active: boolean) => {
    if (active) setSnapTurnReady(false);
    setActivePanelInteractions((count) => Math.max(0, count + (active ? 1 : -1)));
  }, []);
  const rightController = useXRInputSourceState("controller", "right");
  const stickHeightRef = useRef({ value: heightOffset, elapsed: 0, active: false });

  useXRControllerLocomotion(
    originRef,
    { speed: panelDragging ? 0 : speed },
    panelDragging || !snapTurnReady
      ? false
      : { type: "snap", degrees: mmdPrefs.snapTurnDegrees, deadZone: 0.65 },
  );

  useEffect(() => {
    const g = originRef.current;
    if (!g) return;
    g.position.set(0, heightOffset, 0);
    g.rotation.set(0, 0, 0);
  }, [viewEpoch]);

  useEffect(() => {
    const g = originRef.current;
    if (g && !stickHeightRef.current.active) g.position.y = heightOffset;
  }, [heightOffset]);

  useEffect(() => () => {
    if (!stickHeightRef.current.active) return;
    useMmdVrStore.getState().setPrefs({ heightOffset: stickHeightRef.current.value });
  }, []);

  useFrame((_, delta) => {
    const stick = rightController?.gamepad["xr-standard-thumbstick"];
    if (!panelDragging && !snapTurnReady && Math.abs(stick?.xAxis ?? 0) < 0.65) {
      setSnapTurnReady(true);
    }
    const axis = stick?.yAxis ?? 0;
    if (panelDragging || Math.abs(axis) < 0.18) {
      if (stickHeightRef.current.active) {
        stickHeightRef.current.active = false;
        useMmdVrStore.getState().setPrefs({ heightOffset: stickHeightRef.current.value });
      } else {
        stickHeightRef.current.value = useMmdVrStore.getState().prefs.heightOffset;
      }
      stickHeightRef.current.elapsed = 0;
      return;
    }
    stickHeightRef.current.active = true;
    const shaped = (Math.abs(axis) - 0.18) / 0.82 * Math.sign(axis);
    const speed = 0.5 + Math.abs(shaped) * 4.5;
    stickHeightRef.current.value = Math.min(
      MMD_VR_HEIGHT_OFFSET_MAX,
      Math.max(MMD_VR_HEIGHT_OFFSET_MIN, stickHeightRef.current.value - shaped * delta * speed),
    );
    if (originRef.current) originRef.current.position.y = stickHeightRef.current.value;
    stickHeightRef.current.elapsed += delta;
    if (stickHeightRef.current.elapsed < 0.1) return;
    stickHeightRef.current.elapsed = 0;
    useMmdVrStore.getState().setHeightOffsetTransient(stickHeightRef.current.value);
  });

  return (
    <XROrigin ref={originRef}>
      <MmdVrControllerColliders />
      <MmdVrHandColliders />
      <MmdVrControlBar
        playLabel={playLabel}
        pauseLabel={pauseLabel}
        loopOnLabel={loopOnLabel}
        loopOffLabel={loopOffLabel}
        resetLabel={resetLabel}
        exitLabel={exitLabel}
        emptyHint={emptyHint}
        hideLabel={hideLabel}
        showLabel={showLabel}
        placeOnLabel={placeOnLabel}
        placeOffLabel={placeOffLabel}
        placeHint={placeHint}
        lightStageLabel={lightStageLabel}
        lightSoftLabel={lightSoftLabel}
        lightContrastLabel={lightContrastLabel}
        lightDaylightLabel={lightDaylightLabel}
        lightWarmLabel={lightWarmLabel}
        lightRimLabel={lightRimLabel}
        shadowsLabel={shadowsLabel}
        gridLabel={gridLabel}
        scaleLabel={scaleLabel}
        rotateLeftLabel={rotateLeftLabel}
        rotateRightLabel={rotateRightLabel}
        heightLabel={heightLabel}
        viewDistanceLabel={viewDistanceLabel}
        resetValueLabel={resetValueLabel}
        panelHideLabel={panelHideLabel}
        panelShowLabel={panelShowLabel}
        panelDragLabel={panelDragLabel}
        panelFollowOnLabel={panelFollowOnLabel}
        panelFollowOffLabel={panelFollowOffLabel}
        fpsOnLabel={fpsOnLabel}
        fpsOffLabel={fpsOffLabel}
        physicsOnLabel={physicsOnLabel}
        physicsOffLabel={physicsOffLabel}
        physicsDebugOnLabel={physicsDebugOnLabel}
        physicsDebugOffLabel={physicsDebugOffLabel}
        physicsSettingsLabel={physicsSettingsLabel}
        visualSettingsLabel={visualSettingsLabel}
        skyOnLabel={skyOnLabel}
        skyOffLabel={skyOffLabel}
        fogOnLabel={fogOnLabel}
        fogOffLabel={fogOffLabel}
        rimLightOnLabel={rimLightOnLabel}
        rimLightOffLabel={rimLightOffLabel}
        lightPoolOnLabel={lightPoolOnLabel}
        lightPoolOffLabel={lightPoolOffLabel}
        handTrackingOnLabel={handTrackingOnLabel}
        handTrackingOffLabel={handTrackingOffLabel}
        physicsCollisionOnLabel={physicsCollisionOnLabel}
        physicsCollisionOffLabel={physicsCollisionOffLabel}
        physicsSelfCollisionOnLabel={physicsSelfCollisionOnLabel}
        physicsSelfCollisionOffLabel={physicsSelfCollisionOffLabel}
        physicsRadiusLabel={physicsRadiusLabel}
        physicsQualityLabels={physicsQualityLabels}
        physicsHapticLevelLabels={physicsHapticLevelLabels}
        physicsBoneFeedbackLabel={physicsBoneFeedbackLabel}
        physicsBoneFeedbackLabels={physicsBoneFeedbackLabels}
        physicsColliderFrictionLabel={physicsColliderFrictionLabel}
        physicsColliderFrictionLabels={physicsColliderFrictionLabels}
        physicsColliderRestitutionLabel={physicsColliderRestitutionLabel}
        physicsColliderRestitutionLabels={physicsColliderRestitutionLabels}
        resetPhysicsLabel={resetPhysicsLabel}
        snapTurnLabel={snapTurnLabel}
        exposureLabel={exposureLabel}
        removeLabel={removeLabel}
        materialsLabel={materialsLabel}
        materialOpacityLabel={materialOpacityLabel}
        materialRoughnessLabel={materialRoughnessLabel}
        materialMetallicLabel={materialMetallicLabel}
        materialEmissionLabel={materialEmissionLabel}
        walkLabels={walkLabels}
        walkSpeedLabel={walkSpeedLabel}
        onDragChange={setPanelDragging}
        onExit={onExit}
        busy={busy}
      />
    </XROrigin>
  );
}
