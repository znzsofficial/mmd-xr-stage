import { test } from "vitest";
import type { MmdDirectBufferPhysicsBackend, MmdPhysicsStepContext } from "@yohawing/three-mmd-loader/physics";
import { createControllerColliderPhysicsBackend, createPhysicsDiagnosticsBackend } from "./mmdPhysics";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

for (const direct of [false, true]) {
  test(`collider wrappers (${direct ? "direct" : "copied"} buffers, 500 bones, 300 bodies)`, async ({ bench }) => {
    const boneCount = 500;
    const base: MmdDirectBufferPhysicsBackend = {
      name: "benchmark", disabled: false, disposed: false,
      step: (context) => {
        context.output!.translations![0] = context.inputTranslations![0];
        return { simulated: true, updatedBoneCount: 0 };
      },
      acquireStepBuffers: (layout) => ({
        inputTranslations: new Float32Array(layout.translationValueCount),
        inputRotations: new Float32Array(layout.rotationValueCount),
        inputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
        outputTranslations: new Float32Array(layout.translationValueCount),
        outputRotations: new Float32Array(layout.rotationValueCount),
        outputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
        bonePhysicsToggles: new Uint8Array(layout.boneCount),
        updatedBoneIndices: new Uint32Array(layout.boneCount),
      }),
    };
    const handMatrices = Array.from({ length: 12 }, () => identity);
    const controllerMatrices = [identity, identity];
    const copiedBackend = { ...base, acquireStepBuffers: undefined };
    const diagnostics = createPhysicsDiagnosticsBackend(direct ? base : copiedBackend);
    const hand = createControllerColliderPhysicsBackend(diagnostics, () => handMatrices);
    const controller = createControllerColliderPhysicsBackend(hand, () => controllerMatrices);
    const buffers = (direct ? controller.acquireStepBuffers! : base.acquireStepBuffers)({
      boneCount, translationValueCount: boneCount * 3, rotationValueCount: boneCount * 4, worldMatrixValueCount: boneCount * 16,
    })!;
    const context = {
      seconds: 1, deltaSeconds: 1 / 90, frame: 30, frameRate: 30,
      skeleton: { bones: Array.from({ length: boneCount }, (_, index) => ({ index })) },
      rigidBodies: Array.from({ length: 300 }, (_, index) => ({ index, motionType: "dynamic", collisionGroup: index % 8, shape: { type: "sphere", size: [1, 1, 1] } })),
      joints: [], inputTranslations: buffers.inputTranslations, inputRotations: buffers.inputRotations,
      inputWorldMatricesColumnMajor: buffers.inputWorldMatricesColumnMajor, bonePhysicsToggles: buffers.bonePhysicsToggles,
      output: { translations: buffers.outputTranslations, rotations: buffers.outputRotations, worldMatricesColumnMajor: buffers.outputWorldMatricesColumnMajor, updatedBoneIndices: buffers.updatedBoneIndices },
    } satisfies MmdPhysicsStepContext;
    controller.step(context);
    await bench("one model step (no Bullet solve)", () => {
      context.seconds += 1 / 90;
      controller.step(context);
    }).run({ time: 1000, warmupTime: 300 });
  });
}
