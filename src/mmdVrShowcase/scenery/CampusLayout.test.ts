import {it,expect} from 'vitest';
import {CAMPUS_DOOR,CAMPUS_OFFSET} from './CampusLayout';
import {roomLinks,RoomGate} from './connections';
import {POOL_ORIGIN,GUARD_CHAIR,PACE_CLOCK,LIDO_PIERS,POOL} from './LidoLayout';
import {canPlaceInScenery} from './placementAreas';
import {roomGround} from '../movement/roomGround';
import type {SceneryId} from './catalog';

function trace(room:SceneryId,path:number[][]){
  for(let i=1;i<path.length;i++){
    const [x,z]=path[i-1],[u,v]=path[i],n=Math.ceil(Math.hypot(u-x,v-z)/.09);
    for(let j=0;j<=n;j++){
      const a=x+(u-x)*j/n,b=z+(v-z)*j/n;
      expect(roomGround(room,a,b),`${room} support ${a}, ${b}`).toBe(0);
      expect(canPlaceInScenery(room,a,b),`${room} footprint ${a}, ${b}`).toBe(true);
    }
  }
}
it('uses the window aisle, garden door, then brick fork clear of the bench and rear case',()=>{
  trace('classroom',[[0,4.48],[CAMPUS_DOOR,4.48],[CAMPUS_DOOR,6.64]]);
  trace('lawn',[[4.97,-7.68],[4.97,-6.66],[3.78,-5.76],[1.80,-5.01],[.25,-3.62],[-1.28,-1.79]]);
  for(const [x,z] of [[-2.45,5.70],[-2.65,6.77],[-8.75,7.22]])expect(canPlaceInScenery('classroom',x,z)).toBe(false);
  expect(roomGround('lawn',CAMPUS_OFFSET.x,CAMPUS_OFFSET.z)).toBe(-Infinity);
});
it.each(roomLinks)('crosses $from → $to only through the opening; translated feet and return runway stay supported',link=>{
  const gate=new RoomGate(),along=(link.band[0]+link.band[1])/2;
  const p=(step:number,s=along):[number,number]=>link.axis==='x'?[link.gate+step*link.direction,s]:[s,link.gate+step*link.direction];
  for(const side of [link.band[0]-.15,link.band[1]+.15]){gate.reset();gate.next(link.from,...p(-.2,side));expect(gate.next(link.from,...p(.2,side))).toBeNull();}
  gate.reset();gate.next(link.from,...p(-4));expect(gate.next(link.from,...p(.1))).toBeNull(); // teleport
  gate.next(link.from,...p(-.13));expect(gate.next(link.from,...p(.09))).toBe(link);
  const [a,b]=p(.09),x=a+link.offset[0],z=b+link.offset[1];
  expect(roomGround(link.to,x,z)).toBe(0);expect(gate.next(link.to,x,z)).toBeNull();expect(gate.next(link.to,x,z)).toBeNull();
  const [u,,v]=link.arrival.eye;expect(canPlaceInScenery(link.to,u,v)).toBe(true);
});
it('connects the wisteria centreline directly to the timing deck on land, not across the basin',()=>{
  trace('lawn',[[-3.2,-4.30],[-4.17,-6.4],[-5.0,-9.5],[-5.25,-12.68]]);
  trace('pool',[[6.15,8.77],[6.15,-19.08],[5.58,-20.3]]);
  for(const r of [GUARD_CHAIR,PACE_CLOCK,...LIDO_PIERS,POOL.water])expect(canPlaceInScenery('pool',r.x,r.z)).toBe(false);
  for(const r of LIDO_PIERS)expect(canPlaceInScenery('lawn',r.x+POOL_ORIGIN.x,r.z+POOL_ORIGIN.z)).toBe(false);
  expect(roomGround('pool',POOL.water.x,POOL.water.z)).toBe(-Infinity);
  expect(roomGround('pool',PACE_CLOCK.x,PACE_CLOCK.z)).toBe(0); // column collision, not a hole in the deck
});
