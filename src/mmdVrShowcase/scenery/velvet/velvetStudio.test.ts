import {describe,expect,it} from 'vitest';
import {Group,Mesh,MeshStandardMaterial} from 'three';
import {createSolidColumns} from '../../movement/solidColumns';
import {resolveStageLighting} from '../../stage/lighting';
import {buildVelvetStudio} from './studioShell';
import {advanceVelvetLight,getVelvetLight,resolveVelvetLight,stripAim,stripX,stripY,stripZ,subscribeVelvetLight} from './velvetLight';
import {velvetDeskSight,velvetEntry,velvetGround,velvetPlace,velvetPlan as p,velvetSight,velvetView} from './velvetLayout';

describe('velvet studio floor and portal',()=>{
  it('offers two unoccupied pairs of actor marks; a wardrobe, sofa or wall is not a landing',()=>{
    expect(velvetPlace(0,0)).toBe(true);
    for(const [x,z] of [...p.mainMarks,...p.wardrobeMarks])expect(velvetPlace(x,z)).toBe(true);
    for(const [x,z] of [p.sofa,p.console,p.wardrobe,p.bench,p.divider[0],p.vanity].map(b=>[b.x,b.z]))expect(velvetPlace(x,z)).toBe(false);
    expect(velvetGround(velvetEntry.x,velvetEntry.z)).toBe(0);expect(velvetGround(7,0)).toBe(-Infinity);
    for(const shot of velvetView.shots)expect(velvetPlace(shot.eye[0],shot.eye[2])).toBe(true);
    const from={x:1.04,y:1.50,z:1.32};
    expect(velvetSight(from,4.09,0,1.1)).toBe(true);expect(velvetSight({...from,z:-1.6},4.09,0,-1.6)).toBe(false);
    expect(velvetSight({...from,y:5.6},4.09,0,1.1)).toBe(false);
    expect(velvetDeskSight({x:4,y:1.6,z:-3},{x:p.console.x,y:1.21,z:p.console.z+.15})).toBe(false);
  });
  it('walks the actual authored triangle meshes from the entrance through the open portal to the wardrobe',()=>{
    const group=new Group(),parts=buildVelvetStudio(),mat=new MeshStandardMaterial();
    for(const {geometry} of parts)group.add(new Mesh(geometry,mat));
    const solids=createSolidColumns();
    const sample=(x:number,z:number)=>{const result={blocked:false,ceiling:Infinity,floor:velvetGround(x,z)};solids.sample([group],x,z,0,result);return result;};
    const route=[[velvetEntry.x,velvetEntry.z],[1.9,1.3],[3.35,1.3],[3.72,-1.65],[5.04,-1.64]];
    try{
      for(let i=1;i<route.length;i++)for(let n=0;n<=9;n++){
        const a=route[i-1],b=route[i],t=n/9,r=sample(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]));
        expect(r.blocked).toBe(false);expect(r.floor).toBeCloseTo(0,1);expect(r.ceiling).toBeGreaterThan(1.91);
      }
      const wall=sample(2.49,-1.4);expect(wall.blocked||wall.ceiling<1.9).toBe(true);
    }finally{solids.invalidate();mat.dispose();parts.forEach(p=>p.geometry.dispose());}
  });
  it('advances the fixture and evaluated directional light together without mutating a global preset',()=>{
    const start=getVelvetLight(),base=resolveStageLighting('stage',{}),notices:unknown[]=[];
    const off=subscribeVelvetLight(()=>notices.push(getVelvetLight()));
    try{
      const first=resolveVelvetLight(base,start);advanceVelvetLight('rail');
      const second=resolveVelvetLight(base,getVelvetLight());expect(second.sunPos).toEqual([stripX(getVelvetLight())-stripAim[0],stripY-stripAim[1],stripZ-stripAim[2]]);
      expect(first.sunPos).not.toEqual(second.sunPos);expect(first.sun).toBe(second.sun);advanceVelvetLight('power');
      expect(resolveVelvetLight(base,getVelvetLight()).sun).not.toBe(second.sun);expect(notices).toHaveLength(2);
      expect(base).toEqual(resolveStageLighting('stage',{}));
    }finally{off();while(getVelvetLight().rail!==start.rail)advanceVelvetLight('rail');while(getVelvetLight().power!==start.power)advanceVelvetLight('power');}
  });
});
