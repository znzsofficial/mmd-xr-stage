import { useFrame } from "@react-three/fiber";
import { useXRInputSourceState, XRSpace } from "@react-three/xr";
import { useContext, useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  clearMmdVrControllerColliders,
  setMmdVrControllerColliderMatrix,
} from "./controllerSlots";
import { ControllerContactHaptics } from './controllerContactHaptics';
import { useMmdVrStore } from "../../mmdVrStore";
import { isWebgpuStageSession } from '../../backpack/sessionAssets';

function gripTracked(tracked: (THREE.Object3D & { transformReady?: boolean }) | null, frame: XRFrame | undefined, delta: number) {
  // The external XR loop resumes at dt=0 after lost tracking. Let Bullet
  // consume a parked slot before a newly acquired pose can move this body.
  return Boolean((delta > 0 || !isWebgpuStageSession()) && frame?.session.visibilityState === "visible" && tracked?.visible && tracked.transformReady !== false);
}

function ControllerCollider({ handedness, index }: { handedness: "left" | "right"; index: 0 | 1 }) {
  const controller = useXRInputSourceState("controller", handedness);
  const physicsEnabled = useMmdVrStore((state) => state.physicsEnabled);
  const physicsDebugEnabled = useMmdVrStore((state) => state.physicsDebugEnabled);
  const colliderRadius = useMmdVrStore((state) => state.prefs.physicsColliderRadius);
  const contactCount = useMmdVrStore((state) => state.physicsControllerContactCounts[index]);
  const ref = useRef<THREE.Object3D>(null);
  const lastPositionRef = useRef<THREE.Vector3 | null>(null);
  const smoothedSpeedRef = useRef(0);
  const positionRef = useRef(new THREE.Vector3());
  const haptics = useContext(ControllerContactHaptics);
  const source = controller?.inputSource;
  useLayoutEffect(() => {
    lastPositionRef.current = null;
    smoothedSpeedRef.current = 0;
    if (source?.gripSpace) return haptics?.bind(index, {
      source, tracked: (frame, delta) => gripTracked(ref.current, frame, delta), speed: () => smoothedSpeedRef.current,
    });
  }, [haptics, index, source]);

  useFrame((_, delta, frame) => {
    const tracked = ref.current;
    if (!tracked || !gripTracked(tracked, frame, delta)) {
      setMmdVrControllerColliderMatrix(index, null);
      lastPositionRef.current = null;
      smoothedSpeedRef.current = 0;
    } else {
      tracked.updateWorldMatrix(true, false);
      setMmdVrControllerColliderMatrix(index, tracked.matrixWorld);
      positionRef.current.setFromMatrixPosition(tracked.matrixWorld);
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
  });

  useEffect(() => () => {
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
