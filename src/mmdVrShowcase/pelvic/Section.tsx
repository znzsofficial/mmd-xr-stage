import {usePelvic} from './store';
import {AtlasHudGraphic} from './atlas/AtlasGraphic';
import type {AtlasActor} from './atlas/painter';

export type PelvicActor=AtlasActor;
/** Read-only live plate. Actor-local angle and mode survive closing the tool
 * sheet, but it cannot capture the hand's ray or simulate a missing sample. */
export function PelvicLiveSection(actor:PelvicActor){
  const visible=usePelvic(s=>s.active?.assetId===actor.assetId&&s.active.runtimeId===actor.runtimeId&&!!s.byAsset[actor.assetId]&&!!s.sample);
  return visible?<AtlasHudGraphic {...actor} scope="pelvic" widthM={.42}/>:null;
}
