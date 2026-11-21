import {expect,it} from 'vitest';
import {roomLinks,RoomGate} from '../connections';
import type {SceneryId} from '../catalog';
import {tourShots} from '../roomViews';
import {resolvePlacementHeight} from '../placementAreas';

// A loop that accumulates translation will seem to work at the first two
// doors but put an XR user in a different part of the lawn on the last one.
function link(a:SceneryId,b:SceneryId){
  const matches=roomLinks.filter(l=>l.from===a&&l.to===b);
  expect(matches,`${a} → ${b}`).toHaveLength(1);
  return matches[0];
}
it('closes the arcade / timing deck / campus loop in a single coordinate system',()=>{
  const loop=[link('lawn','arcadeHall'),link('arcadeHall','pool'),link('pool','lawn')];
  for(const axis of [0,1])expect(loop.reduce((sum,l)=>sum+l.offset[axis],0)).toBeCloseTo(0,6);
});
it.each([['lawn','campusPrintStreet',0],['arcadeHall','arcadePoolOverlook',2.05],['pool','poolArcadeWalk',0],
  ['weddingCourt','weddingBridgeView',.42],['qinhuai','qinhuaiLanternQuay',0]] as const)(
  '%s has a local street tour at standing height, separate from the crossing action',(room,key,y)=>{
    const shot=tourShots(room).find(s=>s.key===key)!;
    expect(shot.link).toBeUndefined();
    const [x,eye,z]=shot.eye;expect(eye-y).toBeCloseTo(1.65);
    expect(resolvePlacementHeight(room,x,z,y)).toBeCloseTo(y);
  });
it.each([['lawn','arcadeHall'],['arcadeHall','pool'],['weddingCourt','qinhuai']] as const)(
  'retains the current floor and crosses the way back at a distinct position: %s ↔ %s',(a,b)=>{
    const go=link(a,b),back=link(b,a),gate=new RoomGate(),mid=(go.band[0]+go.band[1])/2,foot=go.floorY??0;
    expect(go.axis).toBe(back.axis);
    for(const ax of [0,1])expect(go.offset[ax]+back.offset[ax]).toBeCloseTo(0,6);
    const p=(step:number):[number,number]=>go.axis==='x'?[go.gate+step*go.direction,mid]:[mid,go.gate+step*go.direction];
    expect(gate.crossing(a,...p(-.12),...p(.12),foot+3.4)).toBeNull();
    expect(gate.crossing(a,...p(-.12),...p(.12),foot)).toBe(go);
    const [x,z]=p(0);
    const arrival=go.axis==='x'?x+go.offset[0]:z+go.offset[1];
    expect((arrival-back.gate)*go.direction).toBeGreaterThan(0);
  });
