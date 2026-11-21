import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {arcadePaint} from './paintedShell';
import {UPPER,ROOF,opening,skylight} from './arcadeLayout';

it('the tiled finish stops on the floor and skylight lips and leaves the vertical passage open',()=>{
  const result=arcadePaint(),material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(result.room,material),ray=new Raycaster();
  const first=(x:number,y:number,z:number,dy:number)=>{ray.set(new Vector3(x,y,z),new Vector3(0,dy,0));return ray.intersectObject(mesh)[0]?.point.y;};
  try{
    expect(first(1.1,UPPER+.4,opening.front-.04,-1)).toBeCloseTo(.002,3);
    expect(first(1.1,UPPER+.4,opening.front+.04,-1)).toBeCloseTo(UPPER+.002,3);
    expect(first(.12,1.4,.43,1)).toBeUndefined();
    expect(first(.12,UPPER+.4,skylight.back-.04,1)).toBeCloseTo(ROOF-.242,3);
  }finally{Object.values(result).forEach(g=>g.dispose());material.dispose();}
});
