import { expect, it, vi } from "vitest";
import type { MmdPhysicsStepContext } from "@yohawing/three-mmd-loader/physics";
import { ColliderReentry, PARK_Y, syntheticColliderBody } from "./colliderReentry";

it("guards both discontinuous hands with one native read but passes through ongoing fast motion", () => {
  const read = vi.fn((_indices: readonly number[], out: Float32Array) => { out.fill(0); return true; });
  const guard = new ColliderReentry(read, () => 1);
  const shape = { type: "sphere", size: [.05, 0, 0] } as const;
  const rigidBodies = [{ index: 0, boneIndex: 0, shape, motionType: "dynamic" as const },
    ...[1,2].map(i => ({ index: i, boneIndex: i, shape, motionType: "static" as const, [syntheticColliderBody]: true }))];
  const matrices = new Float32Array(48);
  const context: MmdPhysicsStepContext = { rigidBodies, inputWorldMatricesColumnMajor: matrices, seconds: 0, deltaSeconds: 0, frame: 0, frameRate: 30 };
  const tick = (a: number, b: number, dt = 1/90) => {
    matrices[29] = a; matrices[45] = b; guard.apply(context, dt);
    return [matrices[29], matrices[45]];
  };
  tick(1, PARK_Y);
  expect(tick(.04, .04)).toEqual([PARK_Y, PARK_Y]); // still tracked teleport and hidden-to-visible
  expect(read).toHaveBeenCalledTimes(1);
  tick(.3, .04, 0); expect(tick(.04,.04)).toEqual([PARK_Y,PARK_Y]); // zero-delta pose cannot arm
  for(let i=0;i<5;i++) expect(tick(.35,.04)).toEqual([expect.closeTo(.35),PARK_Y]);
  expect(tick(.05,.04)).toEqual([expect.closeTo(.05),PARK_Y]); // other hand need not withdraw
  for(let i=0;i<5;i++) tick(.05,.35);
  read.mockClear(); expect(tick(.04,.05)).toEqual([expect.closeTo(.04),expect.closeTo(.05)]);
  expect(read).not.toHaveBeenCalled();
});
