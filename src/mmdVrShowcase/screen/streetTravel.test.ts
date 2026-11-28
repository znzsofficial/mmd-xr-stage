import {BoxGeometry, Mesh, MeshBasicMaterial, Scene, Vector3} from 'three';
import {expect,it} from 'vitest';
import {screenStreetTravel} from './streetTravel';
import {LIDO_PIERS} from '../scenery/LidoLayout';

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

it('stops a ground-level screen step at the ticket pier but lets the player walk through its opening',()=>{
  const scene=new Scene(),pier=LIDO_PIERS[0],geometry=new BoxGeometry(pier.w,3.48,pier.d),material=new MeshBasicMaterial();
  const post=new Mesh(geometry,material);post.name='player:room-solids';post.position.set(pier.x,1.74,pier.z);scene.add(post);
  const travel=screenStreetTravel(scene,'pool')!,step=new Vector3(),eye=new Vector3(pier.x,1.65,6.53);
  function walk(){for(let i=0;i<58;i++){step.set(0,0,.04);travel.walk(eye,step,1/60);eye.add(step);}}
  try{
    walk();expect(eye.z).toBeLessThan(pier.z-pier.d/2);
    eye.set(6.15,1.65,6.53);walk();expect(eye.z).toBeGreaterThan(8.35);
  }finally{travel.dispose();geometry.dispose();material.dispose();}
});
