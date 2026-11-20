import type { Camera, Scene, WebGLRenderer } from 'three';
import { handContactShape, handReferenceRadius } from '../handContactProfile';
import { createMmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import type { RoomAlphaTiles } from '../mmdRuntime/roomAlphaTiles';
import type { RoomMotionCache } from '../mmdRuntime/roomMotionCache';
import { getMmdVrControllerColliderMatrices } from '../mmdVrControllerColliders';
import { getMmdVrHandColliderMatrices } from '../mmdVrHandColliders';
import { useMmdVrStore } from '../mmdVrStore';
import { prepareMmdVrModel } from '../prepareMmdVrModel';
import { prepareModelGpu } from '../prepareModelGpu';
import { runtimeTiming } from '../runtimeTiming';

const friction = { low: .2, medium: .5, high: .9 } as const;
const restitution = { none: 0, low: .25, high: .55 } as const;

/** Wire the product-specific hooks to one active room. Read contact preferences
 * on demand: a menu edit must not reconstruct the runtime or its Bullet world. */
export function createRoomRuntime(scene: Scene, gl: WebGLRenderer, camera: Camera,
  motionCache?: RoomMotionCache, alphaTiles?: RoomAlphaTiles) {
  const prefs = () => useMmdVrStore.getState().prefs;
  const recordXR = useMmdVrStore.getState().presentation === 'xr';
  return createMmdRuntimeHandle(scene, {
    motionCache, alphaTiles,
    actorPalmCloth: () => prefs().actorPalmCloth,
    chestCompression: () => prefs().chestCompression,
    onPhysicsPoseWork: recordXR ? runtimeTiming.recordPose : undefined,
    onBulletStepWork: recordXR ? runtimeTiming.recordBullet : undefined,
    controllerColliders: getMmdVrControllerColliderMatrices,
    controllerCollidersEnabled: () => gl.xr.isPresenting,
    controllerColliderRadius: () => prefs().physicsColliderRadius,
    handColliders: getMmdVrHandColliderMatrices,
    handCollidersEnabled: () => gl.xr.isPresenting,
    handColliderRadius: () => handReferenceRadius(prefs().physicsColliderRadius),
    handShape: handContactShape,
    controllerColliderFriction: () => friction[prefs().physicsColliderFriction],
    controllerColliderRestitution: () => restitution[prefs().physicsColliderRestitution],
    prepareModel: prepareMmdVrModel,
    prepareGpu: (root, stale, work) => prepareModelGpu(gl, scene, camera, root, stale, work),
  });
}
