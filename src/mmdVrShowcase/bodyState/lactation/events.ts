/** One synchronous offer to the current room. There is no replay, even if an
 * outlet becomes visible on a later frame or a different room mounts. */
export type MilkEffectEvent =
  | {kind:'drain';assetId:string;runtimeId:string;side:'left'|'right';amount:number}
  | {kind:'clear';assetId:string};
type Listener = (event:MilkEffectEvent)=>boolean|void;
const listeners = new Set<Listener>();
export function subscribeMilkEffects(listener:Listener) {
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}
export function offerMilkDrain(event:Extract<MilkEffectEvent,{kind:'drain'}>) {
  for(const receive of listeners)if(receive(event))return true;
  return false;
}
export function clearMilkEffects(assetId:string) {
  for(const receive of listeners)receive({kind:'clear',assetId});
}
