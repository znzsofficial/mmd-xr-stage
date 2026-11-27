import {isSceneryId,type SceneryId} from '../scenery/catalog';
import type { StageSnapshot } from '../stage/stageSnapshot';
import {MMD_VR_MAX_MODELS,MMD_VR_MAX_OBJECTS} from '../backpack/sessionAssets';

export const supportsWebgpuRoom=isSceneryId;
export function fitsWebgpuRoom(layout:StageSnapshot|null|undefined){
  if(!layout)return true;
  const models=layout.assets.filter(slot=>slot.kind==='model').length;
  return models<=MMD_VR_MAX_MODELS && layout.assets.length-models<=MMD_VR_MAX_OBJECTS &&
    layout.models.length<=MMD_VR_MAX_MODELS && layout.objects.length<=MMD_VR_MAX_OBJECTS;
}

/** The game owns the library, stage and HUD. An optional renderer owns just
 * its XR session lifetime. start must request XR in the original click. */
export type FloorSession = {
  readonly status: {phase:string;error?:string};
  done:Promise<void>;
  stop():void;
};
export type StartFloorSession = (options:{resume:boolean;onStatus:()=>void})=>FloorSession;
export type LoadFloorBackend = ()=>Promise<StartFloorSession>;

export function usesFloorBackend(scenery:SceneryId, resume:boolean, saved?:SceneryId) {
  return supportsWebgpuRoom(scenery) && (!resume || supportsWebgpuRoom(saved));
}
