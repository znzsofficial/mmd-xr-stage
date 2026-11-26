import { useFrame } from "@react-three/fiber";
import { useXRInputSourceState, XRSpace } from "@react-three/xr";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  clearMmdVrHandColliders,
  setMmdVrHandColliderMatrix,
} from "./handSlots";
import { useMmdVrStore } from "../../mmdVrStore";
import { isSoloFloorSession } from '../../backpack/sessionAssets';
import { HAND_JOINTS, handContactLayout, handReferenceRadius } from "./handContactProfile";

function HandCollider({ handedness, baseIndex }: { handedness: "left" | "right"; baseIndex: 0 | 6 }) {
  const hand = useXRInputSourceState("hand", handedness);
  const physicsEnabled = useMmdVrStore((state) => state.physicsEnabled);
  const physicsDebugEnabled = useMmdVrStore((state) => state.physicsDebugEnabled);
  const radius = useMmdVrStore((state) => handReferenceRadius(state.prefs.physicsColliderRadius));
  const refs = useRef<Partial<Record<(typeof HAND_JOINTS)[number], THREE.Object3D | null>>>({});
  const active = useRef(false);

  useEffect(() => () => {
    for (let i = 0; i < HAND_JOINTS.length; i += 1) setMmdVrHandColliderMatrix(baseIndex + i, null);
  }, [baseIndex]);

  useFrame((_, delta, frame) => {
    if (!hand || !physicsEnabled || !frame || frame.session.visibilityState !== "visible" || (delta <= 0 && isSoloFloorSession())) {
      if (active.current) {
        for (let i = 0; i < HAND_JOINTS.length; i += 1) setMmdVrHandColliderMatrix(baseIndex + i, null);
        active.current = false;
      }
      return;
    }
    active.current = true;
    for (let i = 0; i < HAND_JOINTS.length; i += 1) {
      const joint = HAND_JOINTS[i];
      const tracked = refs.current[joint];
      const jointSpace = tracked?.parent as (THREE.Object3D & { transformReady?: boolean }) | null;
      if (!tracked || !jointSpace?.visible || jointSpace.transformReady !== true) {
        setMmdVrHandColliderMatrix(baseIndex + i, null);
        continue;
      }
      tracked.updateWorldMatrix(true, false);
      setMmdVrHandColliderMatrix(baseIndex + i, tracked.matrixWorld);
    }
  }, -1);

  const jointSpaces = useMemo(
    () => (hand?.inputSource.hand
      ? HAND_JOINTS.flatMap((joint, slot) => {
          const space = hand.inputSource.hand.get(joint);
          return space ? [{ joint, space, ...handContactLayout(slot, radius) }] : [];
        })
      : null),
    [hand, radius],
  );
  if (!jointSpaces || !physicsEnabled) return null;

  return (
    <>
      {jointSpaces.map(({ joint, space, shape, offsetZ, rotateX }) => (
        <XRSpace key={joint} space={space}>
          <group position={[0, 0, offsetZ]} rotation={[rotateX, 0, 0]} ref={object => { refs.current[joint] = object; }}>
            {physicsDebugEnabled && <mesh raycast={() => null}>
              {shape.type === "box"
                ? <boxGeometry args={[2 * shape.size[0], 2 * shape.size[1], 2 * shape.size[2]]} />
                : <capsuleGeometry args={[shape.size[0], shape.size[1], 4, 12]} />}
              <meshBasicMaterial color="#7dff72" transparent opacity={0.5} depthWrite={false} />
            </mesh>}
          </group>
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
