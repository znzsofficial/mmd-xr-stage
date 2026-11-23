import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {createWindFocus,windPlateSight} from './windFocus';
import {lanes,windPoint} from './windAtlas';
import {chartBearings,dialRadius,northBezel} from './departureDial';

it('keeps the landing quiet, charts a single inspected collar and retains the route in flight both ways',()=>{
  for(const lane of lanes){const f=createWindFocus(),foot=new Vector3(),up=new Vector3(),eye=new Vector3(),other=lanes.find(l=>l!==lane)!;
    expect(f.read(new Vector3(0,1.65,1.9))).toBeNull();f.select(other);expect(f.read(new Vector3(0,1.65,1.9))).toBe(other);
    for(const back of [false,true])for(let i=0;i<=80;i++){
      const t=back?1-i/80:i/80;windPoint(lane,t,foot);up.copy(lane.home.up).lerp(lane.away.up,t).normalize();eye.copy(foot).addScaledVector(up,1.60);
      expect(f.read(eye),`${lane.moon.id}: ${t}`).toBe(lane);
    }
    expect(f.read(new Vector3(0,1.65,0))).toBeNull();
    expect(windPlateSight(lane,true,lane.moon.centre,lane.away.foot)).toBe(false);
    expect(windPlateSight(lane,false,new Vector3(0,-5,0),lane.home.foot)).toBe(false);
  }
});

it('has an engraved bearing to every walkable launch, and a bezel beside—not over—the level compass face',()=>{
  expect(new Set(chartBearings.map(r=>r.number)).size).toBe(lanes.length);
  for(const lane of lanes){const mark=chartBearings.find(r=>r.number===lane.moon.sign.split(' · ')[0])!;
    const arrow=new Vector3(Math.sin(mark.angle),0,-Math.cos(mark.angle));
    expect(arrow.dot(lane.home.foot.clone().setY(0).normalize())).toBeCloseTo(1,9);
  }
  const bezel=northBezel(),v=bezel.attributes.position;
  try{let join=0;for(let i=0;i<v.count;i++){expect(v.getY(i)).toBeLessThanOrEqual(0);
    if(v.getY(i)===0){expect(Math.hypot(v.getX(i),v.getZ(i))).toBeCloseTo(dialRadius,5);join++;}}
    expect(join).toBeGreaterThan(100);
  }finally{bezel.dispose();}
});
