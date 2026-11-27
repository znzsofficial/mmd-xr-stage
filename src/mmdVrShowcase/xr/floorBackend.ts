import {isSceneryId,type SceneryId} from '../scenery/catalog';
import type { StageSnapshot } from '../stage/stageSnapshot';

export const supportsWebgpuRoom=isSceneryId;
export const fitsWebgpuRoom=(layout:StageSnapshot|null|undefined)=>!layout || (layout.assets.length<=1 && layout.assets.every(slot=>slot.kind==='model') && layout.models.length<=1 && !layout.objects.length);

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
