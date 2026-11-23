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
const sideNames=[['Left',1],['Right',-1]] as const;

/** Add actual skin support under feet, knees, pelvis, head and palms. All
 * checks below sample rendered-mesh CPU skinning, not estimated FK bounds. */
function addSkin(m:ThreeMmdModel){
  const mesh=m.mesh, g=mesh.geometry, p:number[]=[],j:number[]=[],w:number[]=[];
  for(const [name,rx,ry,rz] of [['Pelvis',.14,.085,.116],['Spine',.15,.12,.10],['Head',.12,.14,.13],
    ...['Left','Right'].flatMap(s=>[[s+'Arm',.038,.04,.04],[s+'Elbow',.032,.032,.032],[s+'Hand',.055,.024,.039],[s+'Foot',.04,.04,.09],[s+'Knee',.054,.047,.04]])] as [string,number,number,number][]){
    const k=mesh.skeleton.bones.indexOf(at(m,name)),v=new Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[k].clone().invert());
    for(const x of [-rx,rx])for(const y of [-ry,ry])for(const z of [-rz,rz]){p.push(v.x+x,v.y+y,v.z+z);j.push(k,0,0,0);w.push(1,0,0,0);}
  }
  g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('skinIndex',new Uint16BufferAttribute(j,4));g.setAttribute('skinWeight',new Float32BufferAttribute(w,4));
}
function bottom(m:ThreeMmdModel,bone?:string){m.root.updateMatrixWorld(true);let min=Infinity;const v=new Vector3();
  const k=bone?m.mesh.skeleton.bones.indexOf(at(m,bone)):-1;
  for(let i=0;i<m.mesh.geometry.attributes.position.count;i++)if(k===-1||k===m.mesh.geometry.attributes.skinIndex.getX(i))min=Math.min(min,m.mesh.localToWorld(m.mesh.getVertexPosition(i,v)).y);return min;}

it.each([true,false])('builds distinct grounded silhouettes from bind, independent of scale, root yaw, VMD body frame or prior edits (native=%s)',async native=>{
  const f=poseFixture(),loader=new ThreeMmdLoader(native?{}:{runtimeFactory:()=>new DefaultMmdRuntime()});
  const m=await loader.loadModel(f.pmx,{materialRenderOrder:false,outline:false}),vmd=await loader.loadAnimation(f.vmd);
  addSkin(m);m.root.scale.setScalar(native?.14:1.79);m.root.rotation.y=native?-1.2:.73;m.root.position.set(2.7,4.2,-7.5);m.root.updateMatrixWorld(true);
  const rest=lengths(m), ground=bottom(m),root=m.root.matrix.toArray(), poses:number[][]=[];
  const look=new Vector3(0,0,1);
  try{for(const t of [.13,1.61]){
    m.setAnimation(vmd);m.update(t,{physics:false});const original=frame(m),runtime=m.runtime;
    const s=createPoseSolver(m,vmd,t),expression=[...m.mesh.morphTargetInfluences!],eye=at(m,'LeftEye').quaternion.clone();
    try{for(const [i,{id}] of posePresets.entries()){
      s.rotate('pelvis','z',.27);s.rotate('rightHand','x',.42);
      expect(s.canPreset(id)).toBe(true);expect(s.applyPreset(id)).toBe(true);m.update(t,edit);
      expect(m.root.matrix.toArray()).toEqual(root);expect(bottom(m),id).toBeCloseTo(ground,4);
      expect(error(lengths(m),rest)).toBeLessThan(2e-5);
      expect(expression[1]).toBeGreaterThan(.1);expect(m.mesh.morphTargetInfluences).toEqual(expression);
      expect(eye.angleTo(new Quaternion())).toBeGreaterThan(.18);expect(at(m,'LeftEye').quaternion.angleTo(eye)).toBeLessThan(.0007);
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
      }else if(id==='standingLean'){
        expect(hip.y).toBeGreaterThan(.90);expect(head.z-hip.z).toBeGreaterThan(.38);expect(ankle.y).toBeLessThan(.07);
      }else if(id==='thighCradle'){
        expect(axis.y).toBeGreaterThan(.96);
        expect((Math.min(...['Pelvis','Spine','Head'].map(b=>bottom(m,b)))-ground)/m.root.scale.y).toBeLessThan(.012);
        for(const [side,sign] of sideNames){
          const thigh=local(m,side+'Thigh'), knee=local(m,side+'Knee'), hand=local(m,side+'Hand'),arm=local(m,side+'Arm');
          expect(sign*(knee.x-arm.x)).toBeGreaterThan(.15);expect(thigh.z-knee.z).toBeGreaterThan(.28);
          expect(knee.y-thigh.y).toBeGreaterThan(.19);expect(local(m,side+'Foot').y-knee.y).toBeGreaterThan(.22);
          const along=knee.sub(thigh).normalize(), reach=hand.sub(thigh),distance=reach.dot(along);reach.addScaledVector(along,-distance);
          expect(distance).toBeGreaterThan(.23);expect(distance).toBeLessThan(.39);expect(reach.x*sign).toBeLessThan(-.035);expect(reach.length()).toBeLessThan(.12);
        }
      }else if(id==='forearmKneel'){
        expect(axis.y).toBeLessThan(-.80);
        for(const [side] of sideNames){
          const elbow=local(m,side+'Elbow'), hand=local(m,side+'Hand');
          expect(hip.y-local(m,side+'Arm').y).toBeGreaterThan(.18);expect(hand.z-elbow.z).toBeGreaterThan(.24);
          for(const joint of ['Elbow','Hand','Knee'])expect((bottom(m,side+joint)-ground)/m.root.scale.y,side+joint).toBeLessThan(.030);
        }
      }else if(id==='sideLegLift'){
        expect(axis.x).toBeLessThan(-.95);expect(ankle.y-local(m,'RightFoot').y).toBeGreaterThan(.72);
        for(const part of ['RightArm','RightKnee','RightFoot']) expect((bottom(m,part)-ground)/m.root.scale.y,part).toBeLessThan(.035);
        expect((bottom(m,'Pelvis')-ground)/m.root.scale.y).toBeLessThan(.065);
        expect(local(m,'RightFoot').z-local(m,'RightThigh').z).toBeGreaterThan(.88);
        expect(wrist.distanceTo(local(m,'LeftThigh').lerp(knee,.54))).toBeLessThan(.14);
        const fingers=local(m,'LeftIndex1').sub(wrist).normalize();expect(fingers.dot(knee.sub(local(m,'LeftThigh')).normalize())).toBeGreaterThan(.95);
      }else if(id==='coveredKneel'){
        expect(head.y-hip.y).toBeGreaterThan(.65);expect(hip.z-head.z).toBeGreaterThan(.15);
        expect(knee.x-local(m,'RightKnee').x).toBeGreaterThan(.70);expect(hip.y).toBeLessThan(.32);
        for(const [side,sign] of sideNames){
          const shoulder=local(m,side+'Arm'), elbow=local(m,side+'Elbow'), hand=local(m,side+'Hand');
          expect((bottom(m,side+'Knee')-ground)/m.root.scale.y).toBeLessThan(.025);
          expect(elbow.x*sign).toBeGreaterThan(.10);expect(hand.x*sign).toBeLessThan(-.075);
          expect(hand.y).toBeLessThan(shoulder.y);expect(hand.y).toBeGreaterThan(shoulder.y-.23);expect(hand.z-shoulder.z).toBeGreaterThan(.12);
        }
        expect(wrist.y-local(m,'RightHand').y).toBeGreaterThan(.045);
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

it('cups the drawn inner thighs: the palms follow a thicker leg without moving the knees',async()=>{
  const loader=new ThreeMmdLoader(),f=poseFixture();
  async function sample(radius:number) {
    const m=await loader.loadModel(f.pmx,{outline:false});
    const p:number[]=[],j:number[]=[],w:number[]=[];
    for(const [side] of sideNames){
      const thigh=local(m,side+'Thigh'),shaft=local(m,side+'Knee').sub(thigh),along=shaft.clone().normalize();
      const k=m.mesh.skeleton.bones.indexOf(at(m,side+'Thigh'));
      const radial=new Vector3(1,0,0),other=along.clone().cross(radial);
      for(const t of [.4,.5,.6,.7,.8,.9])for(let i=0;i<32;i++){
        const angle=i*Math.PI/16,v=thigh.clone().addScaledVector(shaft,t).addScaledVector(radial,radius*Math.cos(angle)).addScaledVector(other,radius*Math.sin(angle));
        p.push(...v.toArray());j.push(k,0,0,0);w.push(1,0,0,0);
      }
    }
    const g=m.mesh.geometry;g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('skinIndex',new Uint16BufferAttribute(j,4));g.setAttribute('skinWeight',new Float32BufferAttribute(w,4));
    const pose=createPoseSolver(m,null,0);
    try{
      expect(pose.applyPreset('thighCradle')).toBe(true);m.update(0,edit);
      return sideNames.map(([side])=>{
        const atPalm=local(m,side+'Hand').lerp(local(m,side+'Index1'),.7),along=local(m,side+'Knee').sub(local(m,side+'Thigh'));
        const reach=atPalm.sub(local(m,side+'Thigh'));reach.addScaledVector(along,-reach.dot(along)/along.lengthSq());
        expect(reach.length()-radius).toBeGreaterThan(.005);expect(reach.length()-radius).toBeLessThan(.022);
        return {reach,knee:along};
      });
    }finally{pose.restore();disposeMmdModel(m);}
  }
  const narrow=await sample(.048),wide=await sample(.105);
  for(const [i,{reach,knee}] of wide.entries()){
    expect(knee.distanceTo(narrow[i].knee)).toBeLessThan(1e-5);
    expect(reach.distanceTo(narrow[i].reach)).toBeGreaterThan(.05);
  }
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
