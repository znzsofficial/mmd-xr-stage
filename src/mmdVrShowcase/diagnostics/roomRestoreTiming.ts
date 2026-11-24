import type { SceneryId } from '../scenery/catalog';
import type { PlacementWork } from './placementWork';
import type { AssetLoadTask } from '../stage/loading/mmdAssetLoadQueue';

/** Per attempted motion task. No File, path, track or model names. */
export interface RestoreMotionWork {
  slot: 'body' | 'face';
  cache?: 'hit' | 'pending' | 'miss' | 'oversize' | 'none';
  evaluator?: 'wasm-adapter' | 'js' | 'other';
  loadWallMs?: number;
  setAnimationMs?: number;
}

/** One XR session observes one room-change transaction. Don't keep Files,
 * diagnostic messages, display names or live geometry in exported events. */
export function createRoomRestoreTiming(clock=()=>performance.now()){
  type Trace={from:SceneryId;to:SceneryId;start:number;queueAt:number|null;readyAt:number|null;success:boolean;
    modelWork:PlacementWork[];motionWork:RestoreMotionWork[];taskWallMs:Partial<Record<AssetLoadTask['phase'],number>>};
  let pending:Trace|null=null;
  return {
    begin(from:SceneryId,to:SceneryId,hasSavedAssets:boolean){pending=hasSavedAssets?{from,to,start:clock(),queueAt:null,readyAt:null,success:false,modelWork:[],motionWork:[],taskWallMs:{}}:null;},
    bind(room:SceneryId){const t=pending;if(!t||t.to!==room)return;
      return {modelWork:t.modelWork,motionWork:t.motionWork,wrap(tasks:AssetLoadTask[]){return tasks.map(task=>({...task,run:async()=>{
        const at=clock();t.queueAt??=at;try{return await task.run();}finally{t.taskWallMs[task.phase]=(t.taskWallMs[task.phase]??0)+clock()-at;}
      }}));},ready(success:boolean){if(pending===t&&t.readyAt===null){t.readyAt=clock();t.success=success;}}};},
    cancel(){pending=null;},
    frame(room:SceneryId){const t=pending;if(!t||t.to!==room||t.readyAt===null||t.queueAt===null)return;
      pending=null;const now=clock();return {from:t.from,to:t.to,success:t.success,entryToVisibleFrameMs:Math.round(now-t.start),
         preQueueMs:Math.round(t.queueAt-t.start),queueToReadyMs:Math.round(t.readyAt-t.queueAt),readyToFrameMs:Math.round(now-t.readyAt),taskWallMs:{...t.taskWallMs},modelWork:t.modelWork.map(w=>({...w,loaderStagesMs:{...w.loaderStagesMs}})),motionWork:t.motionWork.map(w=>({...w}))};},
  };
}
export const xrRoomRestoreTiming=createRoomRestoreTiming();
export type RoomRestoreEvent=NonNullable<ReturnType<typeof xrRoomRestoreTiming.frame>>;
