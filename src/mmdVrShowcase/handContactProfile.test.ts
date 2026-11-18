import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeAll, expect, it } from "vitest";
import { Matrix4, Vector3 } from "three";
import { createCustomBulletMmdPhysicsBackend, type MmdPhysicsStepContext } from "@yohawing/three-mmd-loader/physics";
import { createControllerColliderPhysicsBackend } from "./mmdRuntime/mmdPhysics";
import { handContactLayout, handContactShape, handReferenceRadius } from "./handContactProfile";

type Bullet = Parameters<typeof createCustomBulletMmdPhysicsBackend>[0];
let bullet: Bullet;
beforeAll(async () => {
  // Evaluate the shipped Emscripten classic script as in a browser, using the
  // matching local WASM bytes. No fake solver or network service in this test.
  const dir = new URL("../../public/mmd/0.8.6/", import.meta.url);
  const js = readFileSync(new URL("mmd_bullet.js", dir), "utf8");
  const factory = runInNewContext(`${js};MmdBullet`, { console }) as (o: {wasmBinary: Uint8Array}) => Promise<Bullet>;
  bullet = await factory({ wasmBinary: readFileSync(new URL("mmd_bullet.wasm", dir)) });
});

// Drop a 3mm model body at a known location relative to the tracked joint.
// -Z is towards fingertips in XR. Mirror Z in both pose and probe for Bullet.
function probe(slot: number, localPoint: Vector3, scale: number) {
  const radius = handReferenceRadius(0.08);
  const { offsetZ, rotateX } = handContactLayout(slot, radius);
  const joint = new Matrix4().makeRotationY(0.8);
  const center = new Matrix4().makeRotationX(rotateX).setPosition(0, 0, offsetZ / scale);
  const flip = new Matrix4().makeScale(1, 1, -1);
  const collider = flip.clone().multiply(joint).multiply(center).multiply(flip);
  const p = localPoint.clone().divideScalar(scale).applyMatrix4(joint).applyMatrix4(flip);
  const hidden = Float32Array.from(new Matrix4().makeTranslation(0, -1000, 0).elements);
  const hands = Array.from({ length: 12 }, (_, i) => i === slot ? Float32Array.from(collider.elements) : hidden);
  const native = createCustomBulletMmdPhysicsBackend(bullet);
  const hand = createControllerColliderPhysicsBackend(native, () => hands, radius / scale, undefined, undefined, undefined, handContactShape);
  const controllers = createControllerColliderPhysicsBackend(hand, () => [hidden, hidden]);
  try {
    const buffers = controllers.acquireStepBuffers!({ boneCount: 1, translationValueCount: 3, rotationValueCount: 4, worldMatrixValueCount: 16 })!;
    buffers.inputWorldMatricesColumnMajor.set(new Matrix4().makeTranslation(p.x, p.y, p.z).elements);
    buffers.inputTranslations.set(p.toArray()); buffers.inputRotations.set([0, 0, 0, 1]); buffers.bonePhysicsToggles.fill(1);
    const fixture: MmdPhysicsStepContext = { seconds: 0, deltaSeconds: 1 / 60, frame: 0, frameRate: 30,
      skeleton: { bones: [{ index: 0, restTranslation: [p.x, p.y, p.z] }] }, joints: [],
      rigidBodies: [{ index: 0, boneIndex: 0, mass: 1, motionType: "dynamic", shape: { type: "sphere", size: [0.003 / scale, 0, 0] }, localTranslation: [p.x, p.y, p.z] }],
      inputTranslations: buffers.inputTranslations, inputRotations: buffers.inputRotations,
      inputWorldMatricesColumnMajor: buffers.inputWorldMatricesColumnMajor, bonePhysicsToggles: buffers.bonePhysicsToggles,
      output: { translations: buffers.outputTranslations, rotations: buffers.outputRotations, updatedBoneIndices: buffers.updatedBoneIndices },
    };
    controllers.step(fixture);
    controllers.step({ ...fixture, seconds: 1 / 60, frame: 0.5 });
    expect(controllers.debugControllerContactCount()).toBe(0);
    return hand.debugControllerContactCount(slot) > 0;
  } finally { controllers.dispose?.(); }
}

it.each([0.2, 1, 2])("resolves palm, finger pad and a near miss in world metres at model scale %s", scale => {
  expect(probe(0, new Vector3(0.021, 0, -0.050), scale)).toBe(true);
  expect(probe(6, new Vector3(0, 0.032, -0.04), scale)).toBe(false);
  expect(probe(7, new Vector3(0, 0, 0.020), scale)).toBe(true);
  expect(probe(1, new Vector3(0.026, 0, 0), scale)).toBe(false);
  expect(probe(1, new Vector3(0, 0, -0.025), scale)).toBe(false);
});
