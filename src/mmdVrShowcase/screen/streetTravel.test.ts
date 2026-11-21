import {Scene, Vector3} from 'three';
import {expect,it} from 'vitest';
import {screenStreetTravel} from './streetTravel';

it('walks over the bridge crown at eye height but preserves overhead inspection',()=>{
  const travel=screenStreetTravel(new Scene(),'weddingCourt')!;
  const eye=new Vector3(-11.8,1.65,10.45),d=new Vector3();
  const step=(dx:number,dy:number,dz:number)=>{d.set(dx,dy,dz);travel.walk(eye,d,1/60);eye.add(d);};
  try{
    for(let i=0;i<130;i++)step(-.04,0,0);
    expect(eye.x).toBeCloseTo(-17);expect(eye.y).toBeCloseTo(2.07);
    for(let i=0;i<110;i++)step(0,0,.04);
    expect(eye.z).toBeLessThan(12.19); // ordinary walking cannot cross the parapet into the water
    for(let i=0;i<90;i++)step(0,.04,0);
    const y=eye.y;
    for(let i=0;i<110;i++)step(0,0,.04);
    expect(eye.y).toBeCloseTo(y);expect(eye.z).toBeGreaterThan(14);
  }finally{travel.dispose();}
});
