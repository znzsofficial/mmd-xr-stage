import { DefaultMmdRuntime, ThreeMmdLoader, disposeMmdModel, type ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { Float32BufferAttribute, Quaternion, Uint16BufferAttribute, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { poseFixture } from './poseFixture.testSupport';
import { posePresets } from './presetCatalog';
import { createPoseSolver } from './poseSolver';

const edit={physics:false,ik:false};
const at=(m:ThreeMmdModel,n:string)=>m.mesh.skeleton.getBoneByName(n)!;
const local=(m:ThreeMmdModel,n:string)=>m.mesh.worldToLocal(at(m,n).getWorldPosition(new Vector3()));
const segments=['Left','Right'].flatMap(s=>[['Arm','Elbow'],['Elbow','Hand'],['Thigh','Knee'],['Knee','Foot']].map(([a,b])=>[s+a,s+b]));
function lengths(m:ThreeMmdModel){return segments.map(([a,b])=>local(m,a).distanceTo(local(m,b)));}
const frame=(m:ThreeMmdModel)=>m.mesh.skeleton.bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]);
const error=(a:number[],b:number[])=>Math.max(...a.map((n,i)=>Math.abs(n-b[i])));

/** Add actual skin support under feet, knees, pelvis, head and palms. All
 * checks below sample rendered-mesh CPU skinning, not estimated FK bounds. */
function addSkin(m:ThreeMmdModel){
  const mesh=m.mesh, g=mesh.geometry, p:number[]=[],j:number[]=[],w:number[]=[];
  for(const [name,rx,ry,rz] of [['Pelvis',.14,.085,.116],['Spine',.15,.12,.10],['Head',.12,.14,.13],
    ...['Left','Right'].flatMap(s=>[[s+'Arm',.038,.04,.04],[s+'Hand',.055,.024,.039],[s+'Foot',.04,.04,.09],[s+'Knee',.054,.047,.04]])] as [string,number,number,number][]){
    const k=mesh.skeleton.bones.indexOf(at(m,name)),v=new Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[k].clone().invert());
    for(const x of [-rx,rx])for(const y of [-ry,ry])for(const z of [-rz,rz]){p.push(v.x+x,v.y+y,v.z+z);j.push(k,0,0,0);w.push(1,0,0,0);}
  }
  g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('skinIndex',new Uint16BufferAttribute(j,4));g.setAttribute('skinWeight',new Float32BufferAttribute(w,4));
}
function bottom(m:ThreeMmdModel){m.root.updateMatrixWorld(true);let min=Infinity;const v=new Vector3();
  for(let i=0;i<m.mesh.geometry.attributes.position.count;i++)min=Math.min(min,m.mesh.localToWorld(m.mesh.getVertexPosition(i,v)).y);return min;}

it.each([true,false])('builds six different grounded silhouettes from bind, independent of scale, root yaw, VMD frame or prior edits (native=%s)',async native=>{
  const f=poseFixture(),loader=new ThreeMmdLoader(native?{}:{runtimeFactory:()=>new DefaultMmdRuntime()});
  const m=await loader.loadModel(f.pmx,{materialRenderOrder:false,outline:false}),vmd=await loader.loadAnimation(f.vmd);
  addSkin(m);m.root.scale.setScalar(native?.14:1.79);m.root.rotation.y=native?-1.2:.73;m.root.position.set(2.7,4.2,-7.5);m.root.updateMatrixWorld(true);
  const rest=lengths(m), ground=bottom(m),root=m.root.matrix.toArray(), poses:number[][]=[];
  const look=new Vector3(0,0,1);
  try{for(const t of [.13,1.61]){
    m.setAnimation(vmd);m.update(t,{physics:false});const original=frame(m),runtime=m.runtime;
    const s=createPoseSolver(m,vmd,t);
    try{for(const [i,{id}] of posePresets.entries()){
      s.rotate('pelvis','z',.27);s.rotate('rightHand','x',.42);
      expect(s.canPreset(id)).toBe(true);expect(s.applyPreset(id)).toBe(true);m.update(t,edit);
      expect(m.root.matrix.toArray()).toEqual(root);expect(bottom(m),id).toBeCloseTo(ground,4);
      expect(error(lengths(m),rest)).toBeLessThan(2e-5);
      const axis=look.clone().applyQuaternion(m.mesh.getWorldQuaternion(new Quaternion()).invert().multiply(at(m,'Spine').getWorldQuaternion(new Quaternion())));
      const head=local(m,'Head'), hip=local(m,'Pelvis'), knee=local(m,'LeftKnee'), ankle=local(m,'LeftFoot'), wrist=local(m,'LeftHand');
      const seat=local(m,'LeftThigh').lerp(local(m,'RightThigh'),.5);expect(Math.hypot(seat.x,seat.z)).toBeLessThan(1e-5);
      if(id==='supine'||id==='legsUp'){
        expect(axis.y).toBeGreaterThan(.97);expect(hip.z-head.z).toBeGreaterThan(.66);expect(knee.y-hip.y).toBeGreaterThan(.25);
        if(id==='supine')expect(ankle.y).toBeLessThan(.07);else expect(ankle.y-knee.y).toBeGreaterThan(.32);
      }else if(id==='allFours'){
        expect(axis.y).toBeLessThan(-.95);expect(head.z-hip.z).toBeGreaterThan(.64);
        expect(knee.y).toBeLessThan(.08);expect(wrist.y).toBeLessThan(.05);expect(knee.z-ankle.z).toBeGreaterThan(.40);
      }else if(id==='straddle'){
        expect(head.y-hip.y).toBeGreaterThan(.65);expect(knee.x-local(m,'RightKnee').x).toBeGreaterThan(.75);
        expect(knee.y).toBeLessThan(.08);expect(hip.y).toBeLessThan(.40);
      }else if(id==='side'){
        expect(axis.x).toBeLessThan(-.97);expect(Math.abs(axis.y)).toBeLessThan(.04);expect(Math.abs(head.y-hip.y)).toBeLessThan(.14);
        expect(local(m,'LeftThigh').y-local(m,'RightThigh').y).toBeGreaterThan(.22);
      }else{
        expect(hip.y).toBeGreaterThan(.90);expect(head.z-hip.z).toBeGreaterThan(.38);expect(ankle.y).toBeLessThan(.07);
      }
      if(t===.13)poses.push(frame(m));else expect(error(frame(m),poses[i])).toBeLessThan(1e-5);
    }}finally{s.restore();}
    expect(m.runtime).toBe(runtime);expect(error(frame(m),original)).toBeLessThan(2e-5);
  }}finally{disposeMmdModel(m);}
});

it('has no partial preset on a broken elbow chain, even when pins are held',async()=>{
  const m=await new ThreeMmdLoader().loadModel(poseFixture(true).pmx),s=createPoseSolver(m,null,0);
  try{s.lockFeet(true);s.pinWrist('leftHand',true);const before=s.capture();
    for(const {id} of posePresets){expect(s.canPreset(id)).toBe(false);expect(s.applyPreset(id)).toBe(false);}
    expect(s.capture()).toEqual(before);
  }finally{s.restore();disposeMmdModel(m);}
});

it('fits an authored off-axis bind, offset soles and asymmetric leg lengths rather than assuming a +Z T-pose',async()=>{
  const angle=1.24, c=Math.cos(angle),s=Math.sin(angle);
  const f=poseFixture(false,'both',(name,x,y,z)=>{
    x*=1.15;if(name==='LeftKnee')y-=.12;if(name==='RightKnee')y+=.08;
    return [x*c-z*s+.71,y+.46,x*s+z*c-.35];
  });
  const m=await new ThreeMmdLoader().loadModel(f.pmx,{materialRenderOrder:false});addSkin(m);
  m.root.scale.setScalar(.48);m.root.position.y=-.27;m.root.rotation.y=-.62;m.root.updateMatrixWorld(true);
  const ground=bottom(m),rest=lengths(m),hip=local(m,'LeftThigh').lerp(local(m,'RightThigh'),.5),
    across=local(m,'LeftThigh').sub(local(m,'RightThigh')).normalize(),forward=across.clone().cross(new Vector3(0,1,0));
  const pose=createPoseSolver(m,null,0);
  try{for(const id of ['supine','legsUp','allFours','side'] as const){
    expect(pose.applyPreset(id)).toBe(true);m.update(0,edit);
    expect(error(rest,lengths(m))).toBeLessThan(3e-5);expect(bottom(m)).toBeCloseTo(ground,5);
    const seat=local(m,'LeftThigh').lerp(local(m,'RightThigh'),.5),towardHead=local(m,'Head').sub(seat).normalize();
    expect(seat.x).toBeCloseTo(hip.x,5);expect(seat.z).toBeCloseTo(hip.z,5);
    expect(towardHead.dot(forward)*(id==='allFours'?1:-1)).toBeGreaterThan(.94);
    const q=m.mesh.getWorldQuaternion(new Quaternion()).invert().multiply(at(m,'Spine').getWorldQuaternion(new Quaternion()));
    const face=forward.clone().applyQuaternion(q);if(id==='side')expect(face.dot(across)).toBeLessThan(-.96);
    else expect(face.y*(id==='allFours'?-1:1)).toBeGreaterThan(.94);
  }}finally{pose.restore();disposeMmdModel(m);}
});
