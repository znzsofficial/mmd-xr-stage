import type { TextureResolver, ThreeMmdLoader, ThreeMmdModel } from '@yohawing/three-mmd-loader';
import type { MmdPhysicsBackend, MmdPhysicsStepContext } from '@yohawing/three-mmd-loader/physics';
import type { DirectionalLight } from 'three';
import type { SampleMilkOutlet } from '../bodyState/lactation/outlets';
import type { GarmentPose } from '../pelvic/garment';
import type { EggSurfaceBackend } from '../play/remote/eggSurface';
import type { fitPoseSkirt } from './poseSkirtClearance';

/** A renderer attachment to the room's model. It never loads a PMX, binds a
 * clip, advances a clock or owns a Bullet world. */
export interface RoomActorBinding {
  fitEditedSkirt?(): ReturnType<typeof fitPoseSkirt>;
  beforePose(allowCloth: boolean): void;
  stepPhysics(context: MmdPhysicsStepContext, step: MmdPhysicsBackend['step']): ReturnType<MmdPhysicsBackend['step']>;
  afterPose(seconds: number, delta: number, reseed: boolean): void;
  /** Explicit native seek/placement reset within the same world and topology. */
  reseed(): void;
  interrupt(): void;
  dispose(): void;
}

export interface RoomActorStatus {
  mode: 'gpu' | 'bullet' | 'none' | 'mixed';
  actors: readonly {id:string;visible:boolean;mode:'gpu'|'bullet'|'none';style:ActorStyleState['mode']}[];
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
  style: ActorStyleState | null;
}

export interface ActorStyleState {
  phase:'available'|'loading'|'ready'|'unavailable'|'failed';
  requested:'mmd'|'endfield';
  mode:'mmd'|'endfield';
  clothMaps:number;
  faceMaps:number;
  slots:Readonly<Record<string,number>>;
}

export interface RoomActorStyles {
  subscribe(listener:()=>void):()=>void;
  read(id:string,file:File):Readonly<ActorStyleState>|null;
  choose(id:string,file:File,enabled:boolean):void;
}

export interface RoomActorBackend {
  readonly loadOptions: Parameters<ThreeMmdLoader['loadModel']>[1];
  readonly styles?: RoomActorStyles;
  prepareMilkOutlets?(model:ThreeMmdModel,stale:()=>boolean,bytes?:Uint8Array):Promise<SampleMilkOutlet>;
  getGarmentPose:(runtimeId:string)=>GarmentPose|null;
  getEggSurface?:(runtimeId:string)=>EggSurfaceBackend|undefined;
  attach(model: ThreeMmdModel,source:{file:File;resolver:TextureResolver;companionFiles:readonly File[];pmxBytes?:Uint8Array}): RoomActorBinding;
  setLight(light: DirectionalLight | null): void;
  beginFrame(frame: XRFrame | null, space: XRReferenceSpace | null, reseed: boolean): void;
  prepareRender(poseUpdated:boolean): void;
  readonly status: Readonly<RoomActorStatus>;
  getStatus(): Readonly<RoomActorStatus>;
  setClothEnabled(enabled: boolean): void;
  dispose(): void;
}
