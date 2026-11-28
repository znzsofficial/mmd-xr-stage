import type {BackpackEntry,BackpackLive} from '../backpack/store';
import {BODY_RADIUS,type Column} from './solidColumns';

// Navigation only: a narrow body at each visible actor's root, not the full
// width of its sleeves, hair or animated costume. Hands and cloth stay in the
// existing Bullet contact system. Never skin a PMX just to test a footstep.
export function actorBodies(entries:readonly BackpackEntry[],live:Record<string,BackpackLive>){
  return Object.entries(live).flatMap(([id,actor])=>{
    if(!actor.visible||!actor.bounds||!entries.some(e=>e.id===id&&e.kind==='model'))return [];
    const {size,center}=actor.bounds,h=size[1],r=Math.min(.14*h,.5*Math.max(size[0],size[2]));
    if(!(r>0))return [];
    return [{id,x:actor.position[0],z:actor.position[2],bottom:center[1]-h/2,top:center[1]+h/2,r}];
  });
}
export function sampleBodies(bodies:ReturnType<typeof actorBodies>,x:number,z:number,y:number,c:Column){
  for(const b of bodies){if((x-b.x)**2+(z-b.z)**2>(b.r+BODY_RADIUS)**2)continue;
    if(b.top<=y+.005)c.floor=Math.max(c.floor,b.top);
    else if(b.bottom>y+.005)c.ceiling=Math.min(c.ceiling,b.bottom);
    else {c.blocked=true;return;}
  }
}
