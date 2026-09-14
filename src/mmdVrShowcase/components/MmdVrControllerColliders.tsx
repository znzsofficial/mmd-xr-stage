import { useFrame } from "@react-three/fiber";
import { useXRInputSourceState, XRSpace } from "@react-three/xr";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  clearMmdVrControllerColliders,
  setMmdVrControllerColliderMatrix,
} from "../mmdVrControllerColliders";
import {
  createMmdVrHapticDriver,
  createMmdVrHapticGate,
  getMmdVrHapticFeedback,
  getMmdVrHapticContact,
  supportsMmdVrHaptics,
  type MmdVrHapticGamepad,
} from "../mmdVrHaptics";
import { useMmdVrStore } from "../mmdVrStore";

function ControllerCollider({ handedness, index }: { handedness: "left" | "right"; index: 0 | 1 }) {
  const controller = useXRInputSourceState("controller", handedness);
  const physicsEnabled = useMmdVrStore((state) => state.physicsEnabled);
  const physicsDebugEnabled = useMmdVrStore((state) => state.physicsDebugEnabled);
  const physicsBusy = useMmdVrStore((state) => state.physicsBusy);
  const collisionsEnabled = useMmdVrStore((state) => state.physicsControllerCollisions);
  const colliderRadius = useMmdVrStore((state) => state.prefs.physicsColliderRadius);
  const hapticLevel = useMmdVrStore((state) => state.prefs.physicsHapticLevel);
  const contactCount = useMmdVrStore((state) => state.physicsControllerContactCounts[index]);
  const ref = useRef<THREE.Object3D>(null);
  const hapticGateRef = useRef(createMmdVrHapticGate());
  const hapticDriverRef = useRef(createMmdVrHapticDriver());
  const lastPositionRef = useRef<THREE.Vector3 | null>(null);
  const smoothedSpeedRef = useRef(0);
  const positionRef = useRef(new THREE.Vector3());
  const hapticPathEnabledRef = useRef(false);

  useFrame((state, delta) => {
    const object = ref.current;
    const tracked = object as (THREE.Object3D & { transformReady?: boolean }) | null;
    const trackingReady = Boolean(tracked?.visible && tracked.transformReady !== false);
    if (!trackingReady) {
      setMmdVrControllerColliderMatrix(index, null);
      lastPositionRef.current = null;
      smoothedSpeedRef.current = 0;
    } else {
      tracked!.updateWorldMatrix(true, false);
      setMmdVrControllerColliderMatrix(index, tracked!.matrixWorld);
      positionRef.current.setFromMatrixPosition(tracked!.matrixWorld);
      const previousPosition = lastPositionRef.current;
      if (previousPosition && delta > 0 && delta <= 0.1) {
        const speed = Math.min(3, previousPosition.distanceTo(positionRef.current) / Math.max(delta, 1 / 120));
        const smoothing = 1 - Math.exp(-delta / 0.026);
        smoothedSpeedRef.current += (speed - smoothedSpeedRef.current) * smoothing;
        previousPosition.copy(positionRef.current);
      } else {
        lastPositionRef.current = positionRef.current.clone();
        smoothedSpeedRef.current = 0;
      }
    }

    const gamepad = controller?.inputSource.gamepad as MmdVrHapticGamepad | undefined;
    const hapticPathEnabled = trackingReady
      && physicsEnabled
      && !physicsBusy
      && collisionsEnabled
      && hapticLevel !== "off"
      && supportsMmdVrHaptics(gamepad);
    if (!hapticPathEnabled) {
      hapticGateRef.current.reset();
      if (hapticPathEnabledRef.current) hapticDriverRef.current.reset();
      hapticPathEnabledRef.current = false;
      return;
    }
    hapticPathEnabledRef.current = true;
    const contactActive = getMmdVrHapticContact(index);
    const nowMs = state.clock.elapsedTime * 1000;
    if (hapticGateRef.current.update(contactActive, nowMs)) {
      void hapticDriverRef.current.pulse(
        gamepad,
        getMmdVrHapticFeedback(smoothedSpeedRef.current, hapticLevel),
        nowMs,
      );
    }
  });

  useEffect(() => () => {
    hapticGateRef.current.reset();
    hapticDriverRef.current.reset();
    hapticPathEnabledRef.current = false;
    setMmdVrControllerColliderMatrix(index, null);
  }, [index]);
  if (!controller?.inputSource.gripSpace) return null;
  return (
    <XRSpace ref={ref} space={controller.inputSource.gripSpace}>
      {physicsEnabled && physicsDebugEnabled ? (
        <mesh raycast={() => null}>
          <sphereGeometry args={[colliderRadius, 16, 12]} />
          <meshBasicMaterial color={contactCount > 0 ? "#7dff72" : index === 0 ? "#45d7ff" : "#ff5ca8"} transparent opacity={0.62} depthWrite={false} />
        </mesh>
      ) : null}
    </XRSpace>
  );
}

export function MmdVrControllerColliders() {
  useEffect(() => () => clearMmdVrControllerColliders(), []);
  return (
    <>
      <ControllerCollider handedness="left" index={0} />
      <ControllerCollider handedness="right" index={1} />
    </>
  );
}
