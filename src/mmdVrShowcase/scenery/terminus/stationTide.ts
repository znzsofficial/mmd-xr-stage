import type {createTideClock} from './tideClock';
// Scope the current water level to the mounted scene, just like the mesh.
const clocks=new WeakMap<object,ReturnType<typeof createTideClock>>();
export function bindStationTide(scene:object,clock:ReturnType<typeof createTideClock>){clocks.set(scene,clock);return ()=>{if(clocks.get(scene)===clock)clocks.delete(scene);};}
export function shoreWalkingPace(scene:object,foot:number){const clock=clocks.get(scene);if(!clock)return 1;
  const t=Math.max(0,Math.min(1,(clock.level-foot-.025)/.42));return 1-.42*t*t*(3-2*t);}
