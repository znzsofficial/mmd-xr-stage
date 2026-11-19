import type {
  MmdPhysicsBackend,
  MmdDirectBufferPhysicsBackend,
  MmdPhysicsMatrix4ColumnMajorTuple,
  MmdPhysicsMutableIndexBuffer,
  MmdPhysicsMutableNumericBuffer,
  MmdPhysicsStepContext,
} from "@yohawing/three-mmd-loader/physics";
import type { MmdPhysicsQuality } from "../mmdPhysicsQuality";
import { ColliderReentry, syntheticColliderBody } from "./colliderReentry";
import {isActorPalm} from './actorPalms';

export type { MmdPhysicsQuality };
export type MmdControllerColliderMatrix = MmdPhysicsMatrix4ColumnMajorTuple | Float32Array;
export type MmdControllerColliderProvider = () => readonly MmdControllerColliderMatrix[];
export type ColliderShapeFactory = (index: number, radius: number) => NonNullable<MmdPhysicsStepContext["rigidBodies"]>[number]["shape"];
type PhysicsBoneObserver = (indices: MmdPhysicsMutableIndexBuffer | undefined, count: number, bodies: MmdPhysicsStepContext["rigidBodies"]) => void;
type MmdDebugContact = { rigidBodyIndexA: number; rigidBodyIndexB: number };
const MAX_DEBUG_CONTACTS = 256;
type MmdDebugPhysicsBackend = MmdPhysicsBackend & {
  debugContactCount?: () => number;
  debugPhysicsContacts?: () => readonly MmdDebugContact[];
  debugPhysicsContactsForRigidBodyRange?: (firstRigidBodyIndex: number, rigidBodyCount: number) => readonly MmdDebugContact[];
};
type MmdRuntimePhysicsDiagnostics = {
  debugRigidBodyCount: () => number;
  debugDynamicRigidBodyCount: () => number;
  debugStepCount: () => number;
};

// The 0.8.6 backend reads the catch-up limit, not solver iteration or bone-feedback options.
const MAX_SUBSTEPS: Record<MmdPhysicsQuality, number> = { low:3, medium:5, high:8 };
export type MmdControllerColliderPhysicsBackend = MmdPhysicsBackend & Partial<MmdDirectBufferPhysicsBackend> & {
  debugControllerContactCount: (controllerIndex?: number) => number;
  debugRigidBodyCount: () => number;
  debugDynamicRigidBodyCount: () => number;
  debugStepCount: () => number;
};

let modulePromise: Promise<unknown> | null = null;

async function loadBulletModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const { loadCustomBulletMmdModule } = await import("@yohawing/three-mmd-loader/physics");
      const base = import.meta.env.BASE_URL || "/";
      // Keep the ABI-coupled JS and WASM in the same versioned directory. The
      // Emscripten factory resolves mmd_bullet.wasm relative to this script URL.
      const scriptUrl = new URL("mmd/0.8.6/mmd_bullet.js", window.location.origin + base);
      return loadCustomBulletMmdModule({ scriptUrl: scriptUrl.href, timeoutMs: 30_000 });
    })().catch((error) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

/**
 * One Bullet world per call. Prefer one backend per model — a single world only
 * keeps the last uploaded rigid-body set (identity swap on each step).
 *
 * Tuning matches the official three-mmd-loader viewer defaults. Do not force
 * collisionMargin (default -1); a positive margin can kill body↔cloth contact.
 */
export async function createBulletPhysicsBackend(options: {
  controllerColliders?: MmdControllerColliderProvider;
  controllerRadius?: number | (() => number);
  handColliders?: MmdControllerColliderProvider;
  handRadius?: number | (() => number);
  handShape?: ColliderShapeFactory;
  simulationDelta?: () => number | undefined;
  modelScale?: () => number;
  onPhysicsBones?: PhysicsBoneObserver;
  onBulletStepWork?: (feedMs:number,worldStepMs:number,outputsMs:number,seedOnly:boolean)=>void;
  quality?: () => MmdPhysicsQuality;
  controllerFriction?: () => number;
  controllerRestitution?: () => number;
  dynamicSelfCollision?: boolean;
} = {}): Promise<MmdPhysicsBackend> {
  const { createCustomBulletMmdPhysicsBackend } = await import("@yohawing/three-mmd-loader/physics");
  const module = await loadBulletModule();
  const backendOptions = {
    onStepWork: options.onBulletStepWork,
    fixedTimeStep: 1 / 60,
    maxSubSteps: MAX_SUBSTEPS[options.quality?.() ?? 'medium'],
  };
  const bulletBackend = createCustomBulletMmdPhysicsBackend(
    module as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0],
    backendOptions,
  );
  const diagnosticBackend = createPhysicsDiagnosticsBackend(bulletBackend, options.simulationDelta, options.onPhysicsBones, options.modelScale);
  const backend = options.dynamicSelfCollision
    ? createDynamicSelfCollisionPhysicsBackend(diagnosticBackend)
    : diagnosticBackend;
  const refreshStepOptions = () => {
    backendOptions.maxSubSteps = MAX_SUBSTEPS[options.quality?.() ?? 'medium'];
  };
  const colliderBackend = options.handColliders
    ? createControllerColliderPhysicsBackend(
        backend,
        options.handColliders,
        options.handRadius,
        undefined,
        options.controllerFriction,
        options.controllerRestitution,
        options.handShape,
      )
    : backend;
  return options.controllerColliders
    ? createControllerColliderPhysicsBackend(
        colliderBackend,
        options.controllerColliders,
        options.controllerRadius,
        refreshStepOptions,
        options.controllerFriction,
        options.controllerRestitution,
      )
    : colliderBackend;
}

export function createPhysicsDiagnosticsBackend(backend: MmdPhysicsBackend, simulationDelta?: () => number | undefined, onPhysicsBones?: PhysicsBoneObserver, modelScale = () => 1): MmdPhysicsBackend & MmdRuntimePhysicsDiagnostics {
  const native = backend as MmdPhysicsBackend & { readRigidBodyCenters?: (indices: readonly number[], out: Float32Array) => boolean };
  const guard = native.readRigidBodyCenters ? new ColliderReentry(native.readRigidBodyCenters.bind(native), modelScale) : null;
  let rigidBodyCount = 0;
  let dynamicRigidBodyCount = 0;
  let stepCount = 0;
  let sourceBodies: MmdPhysicsStepContext["rigidBodies"];
  const wrapper: MmdPhysicsBackend & MmdRuntimePhysicsDiagnostics = {
    get name() {
      return `${backend.name}+diagnostics`;
    },
    get disabled() {
      return backend.disabled;
    },
    get disposed() {
      return backend.disposed;
    },
    step(context) {
      stepCount += 1;
      if (sourceBodies !== context.rigidBodies) {
        sourceBodies = context.rigidBodies;
        rigidBodyCount = sourceBodies?.length ?? 0;
        dynamicRigidBodyCount = 0;
        for (const body of sourceBodies ?? []) {
          if (body.motionType !== "static") dynamicRigidBodyCount += 1;
        }
      }
      const dt = simulationDelta?.();
      guard?.apply(context, context.seeking ? 0 : dt ?? context.deltaSeconds);
      const result = dt == null || context.seeking || dt === context.deltaSeconds
        ? backend.step(context)
        : backend.step({ ...context, deltaSeconds: dt });
      onPhysicsBones?.(context.output?.updatedBoneIndices, result.updatedBoneCount ?? 0, context.rigidBodies);
      return result;
    },
    reset: (context) => backend.reset?.(context),
    dispose: () => backend.dispose?.(),
    diagnostics: () => backend.diagnostics?.() ?? [],
    debugRigidBodyWorldTransformsColumnMajor: () => backend.debugRigidBodyWorldTransformsColumnMajor?.() ?? [],
    debugRigidBodyCount: () => rigidBodyCount,
    debugDynamicRigidBodyCount: () => dynamicRigidBodyCount,
    debugStepCount: () => stepCount,
  };

  if (isDirectBufferBackend(backend)) {
    (wrapper as MmdPhysicsBackend & Partial<MmdDirectBufferPhysicsBackend>).acquireStepBuffers =
      (layout) => backend.acquireStepBuffers(layout);
  }
  forwardContactDiagnostics(wrapper, backend);
  return wrapper;
}

export function createDynamicSelfCollisionPhysicsBackend(backend: MmdPhysicsBackend): MmdPhysicsBackend {
  let sourceRigidBodies: MmdPhysicsStepContext["rigidBodies"];
  let collisionRigidBodies: MmdPhysicsStepContext["rigidBodies"];

  const wrapper: MmdPhysicsBackend = {
    get name() {
      return `${backend.name}+dynamic-self-collision`;
    },
    get disabled() {
      return backend.disabled;
    },
    get disposed() {
      return backend.disposed;
    },
    step(context) {
      if (!context.rigidBodies) return backend.step(context);
      if (sourceRigidBodies !== context.rigidBodies) {
        sourceRigidBodies = context.rigidBodies;
        collisionRigidBodies = context.rigidBodies.map((body) => {
          if (body.motionType === "static") return body;
          const group = Math.min(15, Math.max(0, Math.trunc(body.collisionGroup ?? 0)));
          return {
            ...body,
            collisionMask: (body.collisionMask ?? 0xffff) | (1 << group),
          };
        });
      }
      return backend.step({ ...context, rigidBodies: collisionRigidBodies });
    },
    reset: (context) => backend.reset?.(context),
    dispose: () => backend.dispose?.(),
    diagnostics: () => backend.diagnostics?.() ?? [],
    debugRigidBodyWorldTransformsColumnMajor: () => backend.debugRigidBodyWorldTransformsColumnMajor?.() ?? [],
  };

  if (isDirectBufferBackend(backend)) {
    (wrapper as MmdDirectBufferPhysicsBackend).acquireStepBuffers = (layout) => backend.acquireStepBuffers(layout);
  }
  forwardContactDiagnostics(wrapper, backend);
  const runtimeDiagnostics = backend as MmdPhysicsBackend & Partial<MmdRuntimePhysicsDiagnostics>;
  const runtimeWrapper = wrapper as MmdPhysicsBackend & Partial<MmdRuntimePhysicsDiagnostics>;
  if (runtimeDiagnostics.debugRigidBodyCount) runtimeWrapper.debugRigidBodyCount = () => runtimeDiagnostics.debugRigidBodyCount!();
  if (runtimeDiagnostics.debugDynamicRigidBodyCount) runtimeWrapper.debugDynamicRigidBodyCount = () => runtimeDiagnostics.debugDynamicRigidBodyCount!();
  if (runtimeDiagnostics.debugStepCount) runtimeWrapper.debugStepCount = () => runtimeDiagnostics.debugStepCount!();

  return wrapper;
}

export function createControllerColliderPhysicsBackend(
  backend: MmdPhysicsBackend,
  getMatrices: MmdControllerColliderProvider,
  radius: number | (() => number) = 0.08,
  beforeStep?: () => void,
  friction: number | (() => number) = 0.5,
  restitution: number | (() => number) = 0,
  makeShape: ColliderShapeFactory = (_, r) => ({ type: "sphere", size: [r, r, r] }),
): MmdControllerColliderPhysicsBackend {
  let sourceSkeleton: MmdPhysicsStepContext["skeleton"];
  let sourceRigidBodies: MmdPhysicsStepContext["rigidBodies"];
  let augmentedSkeleton: NonNullable<MmdPhysicsStepContext["skeleton"]> | undefined;
  let augmentedRigidBodies: NonNullable<MmdPhysicsStepContext["rigidBodies"]> | undefined;
  let cachedColliderCount = -1;
  let cachedRadius = -1;
  let cachedFriction = -1;
  let cachedRestitution = -1;
  let cachedControllerGroup = -1;
  let directBuffers: ReturnType<MmdDirectBufferPhysicsBackend["acquireStepBuffers"]>;
  let directColliderCount: number | undefined;
  let sourceRigidBodyCount = 0;
  let controllerBodyCount = 0;
  let dynamicRigidBodyCount = 0;
  let stepCount = 0;
  let debugContactsStep = -1;
  let debugContacts: readonly MmdDebugContact[] = [];
  let contactCounts = new Uint32Array(0);
  let totalControllerContacts = 0;
  let bodyMetadataSource: MmdPhysicsStepContext["rigidBodies"];
  let controllerGroup = -1;
  let modelGroupMask = 0;
  let copiedInputTranslations = new Float32Array(0);
  let copiedInputRotations = new Float32Array(0);
  let copiedInputMatrices = new Float32Array(0);
  let copiedOutputTranslations = new Float32Array(0);
  let copiedOutputRotations = new Float32Array(0);
  let copiedOutputMatrices = new Float32Array(0);
  let copiedToggles = new Uint8Array(0);
  const copiedUpdatedIndices: number[] = [];

  const wrapper: MmdControllerColliderPhysicsBackend = {
    get name() {
      return `${backend.name}+controller-colliders`;
    },
    get disabled() {
      return backend.disabled;
    },
    get disposed() {
      return backend.disposed;
    },
    step(context) {
      beforeStep?.();
      stepCount += 1;
      debugContactsStep = -1;
      const matrices = getMatrices();
      if (!matrices.length || !context.skeleton || !context.rigidBodies) {
        controllerBodyCount = 0;
        return backend.step(context);
      }
      const boneCount = context.skeleton.bones.length;
      const colliderCount = matrices.length;
      sourceRigidBodyCount = context.rigidBodies.length;
      controllerBodyCount = colliderCount;
      if (bodyMetadataSource !== context.rigidBodies) {
        bodyMetadataSource = context.rigidBodies;
        dynamicRigidBodyCount = 0;
        modelGroupMask = 0;
        for (const body of context.rigidBodies) {
          if (body.motionType !== "static") dynamicRigidBodyCount += 1;
          if (!(syntheticColliderBody in body)) modelGroupMask |= 1 << Math.min(15, Math.max(0, Math.trunc(body.collisionGroup ?? 0)));
        }
        controllerGroup = chooseControllerCollisionGroup(context.rigidBodies);
      }
      if (directColliderCount !== undefined && colliderCount !== directColliderCount) {
        throw new Error("Controller collider count changed after direct buffers were acquired");
      }
      const colliderRadius = Math.max(0.001, typeof radius === "function" ? radius() : radius);
      const colliderFriction = Math.max(0, Math.min(1, typeof friction === "function" ? friction() : friction));
      const colliderRestitution = Math.max(0, Math.min(1, typeof restitution === "function" ? restitution() : restitution));
      const controllerGroupMask = controllerGroup < 0 ? 0 : 1 << controllerGroup;
      if (
        sourceSkeleton !== context.skeleton ||
        sourceRigidBodies !== context.rigidBodies ||
        cachedColliderCount !== colliderCount ||
        cachedRadius !== colliderRadius ||
        cachedFriction !== colliderFriction ||
        cachedRestitution !== colliderRestitution ||
        cachedControllerGroup !== controllerGroup
      ) {
        sourceSkeleton = context.skeleton;
        sourceRigidBodies = context.rigidBodies;
        cachedColliderCount = colliderCount;
        cachedRadius = colliderRadius;
        cachedFriction = colliderFriction;
        cachedRestitution = colliderRestitution;
        cachedControllerGroup = controllerGroup;
        augmentedSkeleton = {
          bones: [
            ...context.skeleton.bones,
            ...matrices.map((_, index) => ({
              index: boneCount + index,
              name: `xr-controller-${index}`,
              parentIndex: -1,
              restTranslation: [0, 0, 0] as const,
              restRotation: [0, 0, 0, 1] as const,
            })),
          ],
        };
        augmentedRigidBodies = [
          ...context.rigidBodies.map((body) => controllerGroupMask === 0 || syntheticColliderBody in body || isActorPalm(body.name) ? body : ({
            ...body,
            collisionMask: (body.collisionMask ?? 0xffff) | controllerGroupMask,
          })),
          ...matrices.map((_, index) => ({
            [syntheticColliderBody]: true,
            index: context.rigidBodies!.length + index,
            name: `xr-controller-${index}`,
            boneIndex: boneCount + index,
            motionType: "static" as const,
            shape: makeShape(index, colliderRadius),
            localTranslation: [0, 0, 0] as const,
            localRotation: [0, 0, 0, 1] as const,
            mass: 0,
            friction: colliderFriction,
            restitution: colliderRestitution,
            collisionGroup: controllerGroup < 0 ? 15 : controllerGroup,
            // Hands/controllers only interact with model groups. Parked slots
            // coincide; don't create helper-helper manifolds just to discard them later.
            collisionMask: controllerGroup < 0 ? 0 : modelGroupMask,
          })),
        ];
      }
      const isDirect = directBuffers != null && context.inputTranslations === directBuffers.inputTranslations;
      if (isDirect) {
        writeControllerInputs(
          context.inputTranslations as Float32Array,
          context.inputRotations as Float32Array,
          context.inputWorldMatricesColumnMajor as Float32Array,
          context.bonePhysicsToggles as Uint8Array,
          boneCount,
          matrices,
        );
        const result = backend.step({
          ...context,
          skeleton: augmentedSkeleton,
          rigidBodies: augmentedRigidBodies,
        });
        const updated = context.output?.updatedBoneIndices;
        const fallbackCount = Array.isArray(updated) ? updated.length : 0;
        const originalUpdated = compactUpdatedIndices(updated, result.updatedBoneCount ?? fallbackCount, boneCount);
        return { ...result, updatedBoneCount: originalUpdated };
      }

      copiedOutputTranslations = copyExtendedBuffer(copiedOutputTranslations, context.output?.translations, colliderCount * 3);
      copiedOutputRotations = copyExtendedBuffer(copiedOutputRotations, context.output?.rotations, colliderCount * 4);
      copiedOutputMatrices = copyExtendedBuffer(copiedOutputMatrices, context.output?.worldMatricesColumnMajor, colliderCount * 16);
      copiedInputTranslations = copyExtendedBuffer(copiedInputTranslations, context.inputTranslations, colliderCount * 3);
      copiedInputRotations = copyExtendedBuffer(copiedInputRotations, context.inputRotations, colliderCount * 4);
      const rotationOffset = context.inputRotations?.length ?? 0;
      for (let index = 0; index < colliderCount; index += 1) copiedInputRotations[rotationOffset + index * 4 + 3] = 1;
      copiedInputMatrices = copyExtendedBuffer(copiedInputMatrices, context.inputWorldMatricesColumnMajor, colliderCount * 16);
      const matrixOffset = context.inputWorldMatricesColumnMajor?.length ?? 0;
      for (let index = 0; index < colliderCount; index += 1) writeRigidMatrix(copiedInputMatrices, matrixOffset + index * 16, matrices[index]);
      const toggleOffset = context.bonePhysicsToggles?.length ?? 0;
      if (copiedToggles.length !== toggleOffset + colliderCount) copiedToggles = new Uint8Array(toggleOffset + colliderCount);
      for (let index = 0; index < toggleOffset; index += 1) copiedToggles[index] = Number(context.bonePhysicsToggles![index]);
      copiedToggles.fill(1, toggleOffset);
      copiedUpdatedIndices.length = 0;
      const augmented: MmdPhysicsStepContext = {
        ...context,
        skeleton: augmentedSkeleton,
        rigidBodies: augmentedRigidBodies,
        inputTranslations: copiedInputTranslations,
        inputRotations: copiedInputRotations,
        inputWorldMatricesColumnMajor: copiedInputMatrices,
        output: {
          translations: copiedOutputTranslations,
          rotations: copiedOutputRotations,
          worldMatricesColumnMajor: copiedOutputMatrices,
          updatedBoneIndices: copiedUpdatedIndices,
        },
        bonePhysicsToggles: copiedToggles,
      };
      const result = backend.step(augmented);
      copyPrefix(copiedOutputTranslations, context.output?.translations);
      copyPrefix(copiedOutputRotations, context.output?.rotations);
      copyPrefix(copiedOutputMatrices, context.output?.worldMatricesColumnMajor);
      const originalUpdated = compactUpdatedIndices(copiedUpdatedIndices, result.updatedBoneCount ?? copiedUpdatedIndices.length, boneCount);
      copyIndices(copiedUpdatedIndices, context.output?.updatedBoneIndices);
      return { ...result, updatedBoneCount: originalUpdated };
    },
    reset: (context) => {
      controllerBodyCount = 0;
      debugContactsStep = -1;
      backend.reset?.(context);
    },
    dispose: () => {
      controllerBodyCount = 0;
      debugContacts = [];
      debugContactsStep = -1;
      backend.dispose?.();
    },
    diagnostics: () => backend.diagnostics?.() ?? [],
    debugRigidBodyWorldTransformsColumnMajor: () => backend.debugRigidBodyWorldTransformsColumnMajor?.() ?? [],
    debugControllerContactCount: (controllerIndex) => {
      if (controllerBodyCount === 0 || backend.disposed) return 0;
      if (controllerIndex != null && (!Number.isInteger(controllerIndex) || controllerIndex < 0 || controllerIndex >= controllerBodyCount)) return 0;
      const debugBackend = backend as MmdDebugPhysicsBackend;
      // This wrapper appends its bodies before delegating to inner wrappers.
      // Their colliders therefore follow this wrapper's range in Bullet's array.
      const firstBodyIndex = sourceRigidBodyCount;
      if (debugContactsStep !== stepCount) {
        if (debugBackend.debugPhysicsContactsForRigidBodyRange) {
          debugContacts = debugBackend.debugPhysicsContactsForRigidBodyRange(
            firstBodyIndex,
            controllerBodyCount,
          );
        } else {
          const total = debugBackend.debugContactCount?.() ?? 0;
          debugContacts = total <= MAX_DEBUG_CONTACTS ? debugBackend.debugPhysicsContacts?.() ?? [] : [];
        }
        if (contactCounts.length !== controllerBodyCount) contactCounts = new Uint32Array(controllerBodyCount);
        else contactCounts.fill(0);
        totalControllerContacts = 0;
        for (const contact of debugContacts) {
          const bodyA = sourceRigidBodies?.[contact.rigidBodyIndexA];
          const bodyB = sourceRigidBodies?.[contact.rigidBodyIndexB];
          const modelA = bodyA != null && !(syntheticColliderBody in bodyA);
          const modelB = bodyB != null && !(syntheticColliderBody in bodyB);
          if (!modelA && !modelB) continue;
          const a = contact.rigidBodyIndexA - firstBodyIndex;
          const b = contact.rigidBodyIndexB - firstBodyIndex;
          const includesA = a >= 0 && a < controllerBodyCount;
          const includesB = b >= 0 && b < controllerBodyCount;
          if (includesA) contactCounts[a] += 1;
          if (includesB && b !== a) contactCounts[b] += 1;
          if (includesA || includesB) totalControllerContacts += 1;
        }
        debugContactsStep = stepCount;
      }
      return controllerIndex == null ? totalControllerContacts : contactCounts[controllerIndex];
    },
    debugRigidBodyCount: () => (backend as Partial<MmdRuntimePhysicsDiagnostics>).debugRigidBodyCount?.()
      ?? sourceRigidBodyCount + controllerBodyCount,
    debugDynamicRigidBodyCount: () => (backend as Partial<MmdRuntimePhysicsDiagnostics>).debugDynamicRigidBodyCount?.()
      ?? dynamicRigidBodyCount,
    debugStepCount: () => (backend as Partial<MmdRuntimePhysicsDiagnostics>).debugStepCount?.() ?? stepCount,
  };

  if (isDirectBufferBackend(backend)) {
    wrapper.acquireStepBuffers = (layout) => {
      const colliderCount = getMatrices().length;
      directColliderCount = colliderCount;
      directBuffers = backend.acquireStepBuffers({
        boneCount: layout.boneCount + colliderCount,
        translationValueCount: layout.translationValueCount + colliderCount * 3,
        rotationValueCount: layout.rotationValueCount + colliderCount * 4,
        worldMatrixValueCount: layout.worldMatrixValueCount + colliderCount * 16,
      });
      return directBuffers;
    };
  }

  forwardContactDiagnostics(wrapper, backend);

  return wrapper;
}

function chooseControllerCollisionGroup(rigidBodies: readonly NonNullable<MmdPhysicsStepContext["rigidBodies"]>[number][]) {
  let usedGroups = 0;
  for (const body of rigidBodies) {
    const group = Math.min(15, Math.max(0, Math.trunc(body.collisionGroup ?? 0)));
    usedGroups |= 1 << group;
  }
  for (let group = 15; group >= 0; group -= 1) {
    if ((usedGroups & (1 << group)) === 0) return group;
  }
  return -1;
}

function isDirectBufferBackend(backend: MmdPhysicsBackend): backend is MmdDirectBufferPhysicsBackend {
  return typeof (backend as Partial<MmdDirectBufferPhysicsBackend>).acquireStepBuffers === "function";
}

function forwardContactDiagnostics(wrapper: MmdPhysicsBackend, backend: MmdPhysicsBackend) {
  const source = backend as MmdDebugPhysicsBackend;
  const target = wrapper as MmdDebugPhysicsBackend;
  if (source.debugContactCount) target.debugContactCount = () => source.debugContactCount!();
  if (source.debugPhysicsContacts) target.debugPhysicsContacts = () => source.debugPhysicsContacts!();
  if (source.debugPhysicsContactsForRigidBodyRange) {
    target.debugPhysicsContactsForRigidBodyRange = (firstRigidBodyIndex, rigidBodyCount) =>
      source.debugPhysicsContactsForRigidBodyRange!(firstRigidBodyIndex, rigidBodyCount);
  }
}

function writeControllerInputs(
  translations: Float32Array,
  rotations: Float32Array,
  worldMatrices: Float32Array,
  toggles: Uint8Array,
  boneCount: number,
  matrices: readonly MmdControllerColliderMatrix[],
) {
  for (let index = 0; index < matrices.length; index += 1) {
    const boneIndex = boneCount + index;
    translations.fill(0, boneIndex * 3, boneIndex * 3 + 3);
    rotations.fill(0, boneIndex * 4, boneIndex * 4 + 4);
    rotations[boneIndex * 4 + 3] = 1;
    writeRigidMatrix(worldMatrices, boneIndex * 16, matrices[index]);
    toggles[boneIndex] = 1;
  }
}

function compactUpdatedIndices(
  indices: MmdPhysicsMutableIndexBuffer | undefined,
  count: number,
  boneCount: number,
) {
  if (!indices) return 0;
  let write = 0;
  const limit = Math.min(count, indices.length);
  for (let read = 0; read < limit; read += 1) {
    const index = indices[read];
    if (index < boneCount) indices[write++] = index;
  }
  if (Array.isArray(indices)) indices.length = write;
  return write;
}

function copyExtendedBuffer(target: Float32Array<ArrayBuffer>, source: readonly number[] | Float32Array | Float64Array | undefined, extra: number) {
  const length = (source?.length ?? 0) + extra;
  const result = target.length === length ? target : new Float32Array(length);
  if (source) result.set(source);
  result.fill(0, source?.length ?? 0);
  return result;
}

function writeRigidMatrix(
  target: Float32Array,
  offset: number,
  source: MmdControllerColliderMatrix,
) {
  target.set(source, offset);
  for (let column = 0; column < 3; column += 1) {
    const base = offset + column * 4;
    const length = Math.hypot(target[base], target[base + 1], target[base + 2]);
    if (length <= 1e-8) continue;
    target[base] /= length;
    target[base + 1] /= length;
    target[base + 2] /= length;
  }
}


function copyPrefix(source: Float32Array, target: MmdPhysicsMutableNumericBuffer | undefined) {
  if (!target) return;
  const count = Math.min(source.length, target.length);
  for (let index = 0; index < count; index += 1) target[index] = source[index];
}

function copyIndices(source: readonly number[], target: MmdPhysicsMutableIndexBuffer | undefined) {
  if (!target) return;
  if (Array.isArray(target)) {
    target.length = 0;
    for (const index of source) target.push(index);
    return;
  }
  target.fill(0);
  for (let index = 0; index < Math.min(source.length, target.length); index += 1) target[index] = source[index];
}
