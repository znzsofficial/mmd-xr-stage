import { useFrame } from "@react-three/fiber";
import { useXRInputSourceState, XRSpace } from "@react-three/xr";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  clearMmdVrHandColliders,
  setMmdVrHandColliderMatrix,
} from "../mmdVrHandColliders";
import { useMmdVrStore } from "../mmdVrStore";

const HAND_JOINTS = [
  "wrist",
  "index-finger-tip",
  "middle-finger-tip",
  "ring-finger-tip",
  "pinky-finger-tip",
  "thumb-tip",
] as const;

export function getMmdVrHandColliderRadius(): number {
  return Math.max(0.025, useMmdVrStore.getState().prefs.physicsColliderRadius * 0.45);
}

function HandCollider({ handedness, baseIndex }: { handedness: "left" | "right"; baseIndex: 0 | 6 }) {
  const hand = useXRInputSourceState("hand", handedness);
  const handTracking = useMmdVrStore((state) => state.prefs.handTracking);
  const physicsEnabled = useMmdVrStore((state) => state.physicsEnabled);
  const physicsDebugEnabled = useMmdVrStore((state) => state.physicsDebugEnabled);
  const collisionsEnabled = useMmdVrStore((state) => state.physicsControllerCollisions);
  const refs = useRef<Partial<Record<(typeof HAND_JOINTS)[number], THREE.Object3D | null>>>({});

  useEffect(() => () => {
    for (let i = 0; i < HAND_JOINTS.length; i += 1) setMmdVrHandColliderMatrix(baseIndex + i, null);
  }, [baseIndex]);

  useFrame(() => {
    if (!handTracking || !collisionsEnabled) {
      for (let i = 0; i < HAND_JOINTS.length; i += 1) setMmdVrHandColliderMatrix(baseIndex + i, null);
      return;
    }
    for (let i = 0; i < HAND_JOINTS.length; i += 1) {
      const joint = HAND_JOINTS[i];
      const tracked = refs.current[joint] as (THREE.Object3D & { transformReady?: boolean }) | null | undefined;
      if (!tracked?.visible || tracked.transformReady === false) {
        setMmdVrHandColliderMatrix(baseIndex + i, null);
        continue;
      }
      tracked.updateWorldMatrix(true, false);
      setMmdVrHandColliderMatrix(baseIndex + i, tracked.matrixWorld);
    }
  });

  const jointSpaces = useMemo(
    () => (hand?.inputSource.hand
      ? HAND_JOINTS
          .map((joint) => ({ joint, space: hand.inputSource.hand.get(joint) }))
          .filter((entry): entry is { joint: (typeof HAND_JOINTS)[number]; space: XRJointSpace } => Boolean(entry.space))
      : null),
    [hand],
  );
  if (!jointSpaces || !hand?.inputSource.hand || !handTracking) return null;

  return (
    <>
      {jointSpaces.map(({ joint, space }) => (
        <XRSpace
          key={joint}
          ref={(object) => {
            refs.current[joint] = object;
          }}
          space={space}
        >
          {physicsEnabled && physicsDebugEnabled ? (
            <mesh raycast={() => null}>
              <sphereGeometry args={[getMmdVrHandColliderRadius(), 12, 10]} />
              <meshBasicMaterial color="#7dff72" transparent opacity={0.5} depthWrite={false} />
            </mesh>
          ) : null}
        </XRSpace>
      ))}
    </>
  );
}

export function MmdVrHandColliders() {
  useEffect(() => () => clearMmdVrHandColliders(), []);
  return (
    <>
      <HandCollider handedness="left" baseIndex={0} />
      <HandCollider handedness="right" baseIndex={6} />
    </>
  );
}
