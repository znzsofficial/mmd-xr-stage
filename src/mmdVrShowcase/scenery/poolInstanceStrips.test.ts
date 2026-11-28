import {expect,it} from 'vitest';
import {CylinderGeometry,Group,IcosahedronGeometry,InstancedMesh,Matrix4,MeshStandardMaterial,Object3D,PerspectiveCamera,Scene,Vector3,Vector4,type WebGLRenderer} from 'three';
import {poolFurnishings} from './PoolTerrace';
import {indexPoolSurface} from './poolInstanceStrips';
import {LIDO_ROUTE_SHOTS} from './LidoLayout';

// Oracle uses original triangle vertices and a homogeneous clip-plane mask,
// independent of the renderer strip bounds, including the off-axis stereo edge.
function omittedVisible(mesh:InstancedMesh,full:number,cam:PerspectiveCamera){
  const {position:p}=mesh.geometry.attributes,idx=mesh.geometry.index!,mask=new Uint8Array(p.count);
  const m=new Matrix4(),vp=new Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).multiply(mesh.matrixWorld),v=new Vector4();
  for(let k=mesh.count;k<full;k++){
    mesh.getMatrixAt(k,m);m.premultiply(vp);
    for(let i=0;i<p.count;i++){
      const {x,y,z,w}=v.set(p.getX(i),p.getY(i),p.getZ(i),1).applyMatrix4(m);
      mask[i]=+(x < -w)|+(x>w)<<1|+(y < -w)<<2|+(y>w)<<3|+(z < -w)<<4|+(z>w)<<5;
    }
    for(let i=0;i<idx.count;i+=3)if(!(mask[idx.getX(i)]&mask[idx.getX(i+1)]&mask[idx.getX(i+2)]))return k;
  }
  return -1;
}

it('keeps the pace-clock, return and stereo edge geometry, with full instances restored outside each draw',()=>{
  const {crowns,drums}=poolFurnishings(),mat=new MeshStandardMaterial(),scene=new Scene(),group=new Group(),pose=new Object3D();
  for(const [i,batch] of [crowns,drums].entries()){
    const g=indexPoolSurface(i?new CylinderGeometry(.5,.5,1,10):new IcosahedronGeometry(.5,1));
    const full=batch.parts.length,mesh=new InstancedMesh(g,mat,full);
    batch.parts.forEach(({p,s,rx=0,ry=0,rz=0},k)=>{pose.position.set(...p);pose.scale.set(...s);pose.rotation.set(rx,ry,rz);pose.updateMatrix();mesh.setMatrixAt(k,pose.matrix);});
    const before=mesh.onBeforeRender,finish=batch.onInstancesReady(mesh),version=mesh.instanceMatrix.version;
    const draw=(eye:readonly number[],aim:readonly number[],yaw=0,side=0)=>{
      const cam=new PerspectiveCamera(side?91:50,side?1:1100/646,.03,40);
      cam.position.fromArray(eye);cam.lookAt(new Vector3().fromArray(aim));cam.rotateY(yaw*Math.PI/180);cam.translateX(side);
      if(side)cam.projectionMatrix.elements[8]=Math.sign(side)*.12;
      cam.updateMatrixWorld();const args=[null! as WebGLRenderer,scene,cam,g,mat,group] as const;
      mesh.onBeforeRender(...args);const drawn=mesh.count;
      expect(omittedVisible(mesh,full,cam)).toBe(-1);mesh.onAfterRender(...args);expect(mesh.count).toBe(full);return drawn;
    };
    try{
      const {clock,return:back}=LIDO_ROUTE_SHOTS;
      expect(draw(clock.eye,clock.aim)).toBeLessThan(full*.45);
      if(i)expect(draw(back.eye,back.aim)).toBeLessThan(full*.15);
      // Bound submitted crowns at the room entry independently of the total count.
      else expect(draw([2.1,1.7,2.8],[0,.85,-3.7])).toBeLessThanOrEqual(84);
      mesh.position.set(-2,.6,3);mesh.rotation.y=.32;mesh.updateMatrixWorld();
      for(const yaw of [0,36,76,93,145,180,240,303])for(const side of [-.032,.032])draw(clock.eye,clock.aim,yaw,side);
      expect(mesh.instanceMatrix.version).toBe(version);
    }finally{finish();mesh.dispose();g.dispose();}
    expect(mesh.onBeforeRender).toBe(before);
  }
  mat.dispose();
});
