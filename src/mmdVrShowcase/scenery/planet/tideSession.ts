import {tideCentre,tideDatum,tideWaterFootprint} from './tideLayout';
import type {createTideClock} from './tideClock';
import type {Vector3} from 'three';

// Bind the mounted moon's actual clock to its renderer scene. No preference,
// global ticker, or React publication is needed for walking through a pool.
type Clock=ReturnType<typeof createTideClock>;
const pools=new WeakMap<object,Clock>();
export function bindTide(scene:object,clock:Clock){pools.set(scene,clock);return ()=>{if(pools.get(scene)===clock)pools.delete(scene);};}
export function tideWalkFactor(scene:object,foot:Vector3){
  const tide=pools.get(scene);if(!tide||!tideWaterFootprint(foot.x-tideCentre.x,foot.z-tideCentre.z))return 1;
  const t=Math.max(0,Math.min(1,(tide.level-(foot.y-tideDatum)-.035)/.48));return 1-.45*t*t*(3-2*t);
}
