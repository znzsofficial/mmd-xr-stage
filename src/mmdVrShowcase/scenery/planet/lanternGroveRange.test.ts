import {Matrix4,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene,Vector3,Vector4} from 'three';
import {expect,it} from 'vitest';
import {lanternCentre} from './lanternBiosphere';
import {lanternBotany} from './lanternBotany';
import {lanternShots} from './lanternShots';

// Brute-force oracle, independent of the authored grove bounds: a skipped face
// must have all three vertices outside the SAME homogeneous clip plane.
function missedFace(mesh:Mesh,camera:PerspectiveCamera){
  const g=mesh.geometry,p=g.attributes.position,ix=g.index!,{start,count}=g.drawRange;
  const vp=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
  const bits=new Uint8Array(p.count),v=new Vector4();
  for(let i=0;i<bits.length;i++){
    const {x,y,z,w}=v.set(p.getX(i),p.getY(i),p.getZ(i),1).applyMatrix4(vp);
    bits[i]=+(x < -w) | +(x>w)<<1 | +(y < -w)<<2 | +(y>w)<<3 | +(z < -w)<<4 | +(z>w)<<5;
  }
  for(let i=0;i<ix.count;i+=3){if(i>=start&&i<start+count)continue;
    if(!(bits[ix.getX(i)]&bits[ix.getX(i+1)]&bits[ix.getX(i+2)]))return i;}
  return -1;
}

it('keeps every potentially visible face at the clearing, below the caps, at seedfall and through a stereo turn',()=>{
  const {matter,light,veil}=lanternBotany(),scene=new Scene(),material=new MeshBasicMaterial();
  const batches=[matter,light].map(batch=>Object.assign(new Mesh(batch.geometry,material),batch));
  for(const m of batches){m.position.copy(lanternCentre);m.updateMatrixWorld();}
  const total=batches.reduce((n,b)=>n+b.geometry.index!.count,0);
  const draw=(shot:typeof lanternShots[number],yaw=0,offset=0)=>{
    const c=new PerspectiveCamera(offset?95:50,offset?1:1100/646,.03,200);
    c.position.fromArray(shot.eye);if('up' in shot)c.up.fromArray(shot.up);
    c.lookAt(new Vector3().fromArray(shot.aim));c.rotateY(yaw*Math.PI/180);c.translateX(offset);
    if(offset)c.projectionMatrix.elements[8]=Math.sign(offset)*.085;
    c.updateMatrixWorld();let count=0;
    for(const m of batches){m.onBeforeRender(null!,scene,c);
      expect(missedFace(m,c)).toBe(-1);count+=m.geometry.drawRange.count;
      m.onAfterRender();expect(m.geometry.drawRange).toEqual({start:0,count:Infinity});}
    return count;
  };
  try{
    const [globe,gills,nursery,portrait]=lanternShots;
    for(const shot of [portrait,gills,nursery])expect(draw(shot)).toBeLessThan(.72*total);
    expect(draw(portrait,180)).toBe(0);
    for(const yaw of [68,85,100,260,315,0])for(const offset of [-.032,.032])draw(portrait,yaw,offset);
    expect(draw(globe)).toBe(total);
  }finally{for(const m of batches)m.geometry.dispose();material.dispose();veil.dispose();}
});
