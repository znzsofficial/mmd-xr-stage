import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {moonWalk} from '../../movement/moonWalk';
import {createTraveller} from '../../movement/planetTravel';
import {groveSites,reedLake,reedRadius,reedSeaLevel} from './reedBiosphere';
import {lanes,moonObstructed} from './windAtlas';

it('walks off the dry collar, along the submerged bed and back without striking the gauge or trees',()=>{
  const {moon,away}=lanes.find(l=>l.moon.id==='reed')!,s=createTraveller(),dir=new Vector3();s.foot.copy(away.foot);
  const sea=reedRadius+reedSeaLevel,depth=()=>sea-s.foot.distanceTo(moon.centre);
  const approach=(target:Vector3)=>{for(let i=0;i<360&&s.up.angleTo(target)>.007;i++){
    dir.copy(target).projectOnPlane(s.up).normalize();moonWalk(moon,s,dir,2.4,1/90,false);
    expect(s.grounded).toBe(true);
  }expect(s.up.angleTo(target)).toBeLessThan(.008);};
  expect(depth()).toBeLessThan(-.12);approach(reedLake);expect(depth()).toBeGreaterThan(.23);
  approach(away.up);expect(s.foot.distanceTo(away.foot)).toBeLessThan(.06);
  expect(groveSites.length).toBeGreaterThan(1);for(const tree of groveSites)expect(moonObstructed(moon,tree.base,.18,1.65)).toBe(true);
  expect(sea-moon.station.base.distanceTo(moon.centre)).toBeGreaterThan(.055);
});
