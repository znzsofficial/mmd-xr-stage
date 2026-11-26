import type { ThreeMmdLoader, ThreeMmdModel } from '@yohawing/three-mmd-loader';
import type { MmdPhysicsBackend, MmdPhysicsStepContext } from '@yohawing/three-mmd-loader/physics';
import type { DirectionalLight } from 'three';

/** A renderer attachment to the room's model. It never loads a PMX, binds a
 * clip, advances a clock or owns a Bullet world. */
export interface RoomActorBinding {
  beforePose(allowCloth: boolean): void;
  stepPhysics(context: MmdPhysicsStepContext, step: MmdPhysicsBackend['step']): ReturnType<MmdPhysicsBackend['step']>;
  afterPose(seconds: number, delta: number, reseed: boolean): void;
  /** Explicit native seek/placement reset within the same world and topology. */
  reseed(): void;
  interrupt(): void;
  dispose(): void;
}

export interface RoomActorStatus {
  mode: 'gpu' | 'bullet' | 'none';
  nodes: number;
  clothSteps: number;
  /** Model rigid bodies before/after selection, before any XR/prop slots. */
  fullBodies: number;
  keptBodies: number;
  bulletSteps: number;
  bulletSimulatedSteps: number;
  updatedBones: number;
  poseSeconds: number;
  physicsDelta: number;
  evaluations: number;
  palms: readonly string[];
}

export interface RoomActorBackend {
  readonly loadOptions: Parameters<ThreeMmdLoader['loadModel']>[1];
  attach(model: ThreeMmdModel): RoomActorBinding;
  setLight(light: DirectionalLight | null): void;
  beginFrame(frame: XRFrame | null, space: XRReferenceSpace | null, reseed: boolean): void;
  prepareRender(): void;
  readonly status: Readonly<RoomActorStatus>;
  getStatus(): Readonly<RoomActorStatus>;
  setClothEnabled(enabled: boolean): void;
  dispose(): void;
}
