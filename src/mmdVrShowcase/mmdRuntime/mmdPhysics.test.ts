import { describe, expect, it, vi } from "vitest";
import type { MmdPhysicsBackend, MmdPhysicsStepContext, MmdDirectBufferPhysicsBackend, MmdPhysicsStepBufferLayout } from "@yohawing/three-mmd-loader/physics";
import { createCustomBulletMmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import { createControllerColliderPhysicsBackend, createDynamicSelfCollisionPhysicsBackend } from "./mmdPhysics";

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const context = (): MmdPhysicsStepContext => ({
  seconds: 1, deltaSeconds: 1 / 60, frame: 30, frameRate: 30,
  skeleton: { bones: [{ index: 0 }, { index: 1 }] },
  rigidBodies: [0, 1].map((index) => ({ index, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } })),
  joints: [],
});

describe("XR collider physics regression", () => {
  it("keeps the controller range before all 12 hand slots and forwards contact diagnostics", () => {
    const query = vi.fn((first: number) => [{ rigidBodyIndexA: first, rigidBodyIndexB: 0 }]);
    const step = vi.fn((_context: MmdPhysicsStepContext) => ({ simulated: true }));
    const base = { name: "bullet", disabled: false, disposed: false, step, debugPhysicsContactsForRigidBodyRange: query };
    const hand = createControllerColliderPhysicsBackend(base, () => Array.from({ length: 12 }, () => identity), 0.035);
    const controller = createControllerColliderPhysicsBackend(hand, () => [identity, identity], 0.08);
    const input = context();
    controller.step(input);
    const output = step.mock.calls[0][0];
    expect(output.rigidBodies).toHaveLength(16);
    expect(output.rigidBodies?.slice(2, 4).map((body) => body.shape.size[0])).toEqual([0.08, 0.08]);
    expect(output.rigidBodies?.slice(4).every((body) => body.shape.size[0] === 0.035)).toBe(true);
    expect(input.rigidBodies).toHaveLength(2);
    expect(controller.debugControllerContactCount(0)).toBe(1);
    expect(controller.debugControllerContactCount(1)).toBe(0);
    expect(query).toHaveBeenCalledWith(2, 2);
    expect(hand.debugControllerContactCount()).toBe(1);
    expect(query).toHaveBeenCalledWith(4, 12);
  });

  it("normalizes scaled matrices without scaling away translation or radius", () => {
    const step = vi.fn((_context: MmdPhysicsStepContext) => ({ simulated: true }));
    const matrix = new Float32Array([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 7, 8, 9, 1]);
    let radius = 0.16;
    const backend = createControllerColliderPhysicsBackend({ name: "bullet", disabled: false, disposed: false, step }, () => [matrix], () => radius);
    backend.step(context());
    expect([...step.mock.calls[0][0].inputWorldMatricesColumnMajor!.slice(-16)]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1]);
    expect(step.mock.calls[0][0].rigidBodies?.[2].shape.size).toEqual([0.16, 0.16, 0.16]);
    radius = 0.32;
    backend.step(context());
    expect(step.mock.calls[1][0].rigidBodies?.[2].shape.size).toEqual([0.32, 0.32, 0.32]);
  });

  it("does not reset the cloth world when a hidden controller starts tracking", () => {
    const reset = vi.fn();
    const matrix = new Float32Array(identity);
    matrix[13] = -1000;
    const backend = createControllerColliderPhysicsBackend({ name: "bullet", disabled: false, disposed: false, step: () => ({ simulated: true }), reset }, () => [matrix]);
    backend.step(context());
    matrix[13] = 1;
    backend.step(context());
    expect(reset).not.toHaveBeenCalled();
  });

  it("preserves direct buffer ownership and strips collider output indices", () => {
    const acquireStepBuffers = vi.fn((layout: MmdPhysicsStepBufferLayout) => ({
      inputTranslations: new Float32Array(layout.translationValueCount),
      inputRotations: new Float32Array(layout.rotationValueCount),
      inputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
      outputTranslations: new Float32Array(layout.translationValueCount),
      outputRotations: new Float32Array(layout.rotationValueCount),
      outputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
      bonePhysicsToggles: new Uint8Array(layout.boneCount),
      updatedBoneIndices: new Uint32Array(layout.boneCount),
    }));
    const backend = createControllerColliderPhysicsBackend({
      name: "direct", disabled: false, disposed: false, acquireStepBuffers,
      step: (input: MmdPhysicsStepContext) => {
        expect(input.inputTranslations).toBe(buffers.inputTranslations);
        (input.output!.updatedBoneIndices as Uint32Array).set([0, 1, 2]);
        return { simulated: true, updatedBoneCount: 3 };
      },
    } as MmdDirectBufferPhysicsBackend, () => [identity]) as MmdDirectBufferPhysicsBackend;
    const buffers = backend.acquireStepBuffers({ boneCount: 2, translationValueCount: 6, rotationValueCount: 8, worldMatrixValueCount: 32 })!;
    const result = backend.step({ ...context(), inputTranslations: buffers.inputTranslations, inputRotations: buffers.inputRotations,
      inputWorldMatricesColumnMajor: buffers.inputWorldMatricesColumnMajor, bonePhysicsToggles: buffers.bonePhysicsToggles,
      output: { translations: buffers.outputTranslations, rotations: buffers.outputRotations, updatedBoneIndices: buffers.updatedBoneIndices } });
    expect(acquireStepBuffers).toHaveBeenCalledWith({ boneCount: 3, translationValueCount: 9, rotationValueCount: 12, worldMatrixValueCount: 48 });
    expect(result.updatedBoneCount).toBe(2);
  });

  it("updates dynamic self-collision masks without mutating source bodies", () => {
    const step = vi.fn((_context: MmdPhysicsStepContext) => ({ simulated: true }));
    const backend = createDynamicSelfCollisionPhysicsBackend({ name: "bullet", disabled: false, disposed: false, step } satisfies MmdPhysicsBackend);
    const input: MmdPhysicsStepContext = { ...context(), rigidBodies: [{ index: 0, motionType: "dynamic", collisionGroup: 3, collisionMask: 0, shape: { type: "sphere", size: [1, 1, 1] } }] };
    backend.step(input);
    expect(step.mock.calls[0][0].rigidBodies?.[0].collisionMask).toBe(8);
    expect(input.rigidBodies?.[0].collisionMask).toBe(0);
  });
});

describe("published Bullet contact patch", () => {
  it("decodes and filters the native 48-byte contact buffer", () => {
    const memory = new ArrayBuffer(32768);
    const HEAPF32 = new Float32Array(memory);
    const HEAPU32 = new Uint32Array(memory);
    let pointer = 256;
    const module = {
      HEAPF32, HEAPU32, HEAPU8: new Uint8Array(memory),
      _malloc: (bytes: number) => { const p = pointer; pointer += Math.ceil(bytes / 8) * 8; return p; },
      _free: vi.fn(), _mmd_anim_bullet_get_version: () => 0, _mmd_anim_bullet_get_last_error: () => 0,
      _mmd_anim_bullet_world_get_gravity: () => 0, _mmd_anim_bullet_world_set_gravity: () => 0,
      _mmd_anim_bullet_world_create: (p: number) => { HEAPU32[p >>> 2] = 1; return 0; },
      _mmd_anim_bullet_world_destroy: vi.fn(), _mmd_anim_bullet_world_reset: () => 0,
      _mmd_anim_bullet_world_settle_to_current: () => 0, _mmd_anim_bullet_world_step: () => 0,
      _mmd_anim_bullet_world_add_rigidbody: () => 0, _mmd_anim_bullet_world_get_rigidbody_transform: () => 0,
      _mmd_anim_bullet_world_set_rigidbody_transform: () => 0, _mmd_anim_bullet_world_add_6dof_spring_joint: () => 0,
      _mmd_anim_bullet_world_collect_contacts: (_world: number, contacts: number, capacity: number, count: number) => {
        HEAPU32[count >>> 2] = 1;
        if (contacts && capacity) {
          const base = contacts >>> 2;
          new Int32Array(memory).set([2, 0], base);
          HEAPF32.set([-0.125, 1, 2, 3, 4, 5, 6, 0, 1, 0], base + 2);
        }
        return 0;
      },
      refreshMemoryViews: () => undefined,
    } as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0];
    const backend = createCustomBulletMmdPhysicsBackend(module);
    try {
      expect(backend.debugContactCount()).toBe(1);
      expect(backend.debugPhysicsContacts()).toEqual([{ rigidBodyIndexA: 2, rigidBodyIndexB: 0, distance: -0.125,
        positionWorldOnA: [1, 2, 3], positionWorldOnB: [4, 5, 6], normalWorldOnB: [0, 1, 0] }]);
      const patched = backend as typeof backend & { debugPhysicsContactsForRigidBodyRange: (first: number, count: number) => unknown[] };
      expect(patched.debugPhysicsContactsForRigidBodyRange(2, 2)).toHaveLength(1);
      expect(patched.debugPhysicsContactsForRigidBodyRange(4, 12)).toHaveLength(0);
    } finally { backend.dispose?.(); }
  });
});
