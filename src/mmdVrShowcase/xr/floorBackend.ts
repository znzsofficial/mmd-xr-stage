import type { SceneryId } from '../scenery/catalog';

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
  return scenery==='floor' && (!resume || saved==='floor');
}
