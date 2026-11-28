import type { TextureResolver, ThreeMmdLoader, ThreeMmdModel } from '@yohawing/three-mmd-loader';
import type { MmdPhysicsBackend, MmdPhysicsStepContext } from '@yohawing/three-mmd-loader/physics';
import type { DirectionalLight } from 'three';
import type { SampleMilkOutlet } from '../bodyState/lactation/outlets';
import type { GarmentPose } from '../pelvic/garment';
import type { EggSurfaceBackend } from '../play/remote/eggSurface';
import type { fitPoseSkirt } from './poseSkirtClearance';
import type { PlacementWork } from '../diagnostics/placementWork';

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

export type ActorStyleMode = 'mmd'|'endfield'|'strinova';

export interface ActorStyleState {
  phase:'available'|'loading'|'ready'|'unavailable'|'failed';
  requested:ActorStyleMode;
  mode:ActorStyleMode;
  failedModes:readonly ActorStyleMode[];
  hairMasks:number;
  clothMaps:number;
  faceMaps:number;
  slots:Readonly<Record<string,number>>;
}

export interface RoomActorStyles {
  subscribe(listener:()=>void):()=>void;
  read(id:string,file:File):Readonly<ActorStyleState>|null;
  choose(id:string,file:File,mode:ActorStyleMode):void;
}

/** Created by the observing backend, then handed back to that same attachment.
 * A failure before attach has no binding to dispose, so the loader cancels it. */
export interface ModelLoadTiming {
  work: PlacementWork;
  cancel(): void;
}

export interface RoomActorBackend {
  readonly loadOptions: Parameters<ThreeMmdLoader['loadModel']>[1];
  beginModelLoad?(work?: PlacementWork): ModelLoadTiming;
  prepareModelTextures?(model:ThreeMmdModel,stale:()=>boolean,work?:PlacementWork):Promise<void>;
  readonly styles?: RoomActorStyles;
  prepareMilkOutlets?(model:ThreeMmdModel,stale:()=>boolean,bytes?:Uint8Array):Promise<SampleMilkOutlet>;
  getGarmentPose:(runtimeId:string)=>GarmentPose|null;
  getEggSurface?:(runtimeId:string)=>EggSurfaceBackend|undefined;
  attach(model: ThreeMmdModel,source:{file:File;resolver:TextureResolver;companionFiles:readonly File[];pmxBytes?:Uint8Array},timing?:ModelLoadTiming): RoomActorBinding;
  setLight(light: DirectionalLight | null): void;
  beginFrame(frame: XRFrame | null, space: XRReferenceSpace | null, reseed: boolean): void;
  prepareRender(poseUpdated:boolean): void;
  readonly status: Readonly<RoomActorStatus>;
  getStatus(): Readonly<RoomActorStatus>;
  setClothEnabled(enabled: boolean): void;
  dispose(): void;
}
