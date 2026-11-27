import { disposeMmdModel, ThreeMmdLoader } from '@yohawing/three-mmd-loader';
import { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { centerZ, tipHeight } from '../play/siliconeProfile';
import { poseFixture } from '../pose/poseFixture.testSupport';
import { createPoseSolver } from '../pose/poseSolver';
import { defaultPelvicCalibration as c, registerPelvicSocket, samplePelvicFrame } from './geometry';
import { pelvicCenterline, pelvicRailMatrix } from './path';
import { createPartnerDrawing } from './partnerDrawing';

it('braces outside the folded legs on the posed PMX while the contact follows the calibrated arc at placed scale',async()=>{
  const model=await new ThreeMmdLoader().loadModel(poseFixture().pmx,{outline:false,materialRenderOrder:false});
  const host=new Group();host.position.set(-.4,.1,.32);host.rotation.y=-.35;host.scale.setScalar(1.2);
  model.root.position.set(.54,.28,-.8);model.root.rotation.y=.62;model.root.scale.setScalar(.88);
  const pose=createPoseSolver(model,null,0);
  try{
    expect(pose.applyPreset('matingPress')).toBe(true);model.update(0,{physics:false,ik:false});
    const socket=registerPelvicSocket(model.root,c)!,frame=samplePelvicFrame(socket,c)!;
    const figure=createPartnerDrawing(host,model.root,socket.anchor),worldPoint=(name:string)=>figure.group.getObjectByName(name)!.getWorldPosition(new Vector3());
    try{
      const mount=figure.piece.getObjectByName('play:piece:dildo') as Mesh;
      const torso=figure.group.getObjectByName('pelvic:partner-torso') as Mesh;
      expect(torso.material).toBe(mount.material);const material=torso.material as MeshStandardMaterial;
      expect(material).toMatchObject({transparent:true,depthTest:true,depthWrite:false});expect(material.opacity).toBeGreaterThan(.25);expect(material.opacity).toBeLessThan(.6);
      const arms=()=>['left','right'].map(side=>figure.group.worldToLocal(worldPoint(`pelvic:partner-${side}-hand`)).x);
      for(const depth of [-.05,.05,frame.lengthM]){
        figure.draw(frame,pelvicRailMatrix(frame,depth),model.root.position.y);
        const bore=mount.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight)));
        expect(bore.distanceTo(pelvicCenterline(frame,depth).applyMatrix4(frame.world))).toBeLessThan(1e-7);
        const knees=['LeftKnee','RightKnee'].map(n=>figure.group.worldToLocal(model.mesh.skeleton.getBoneByName(n)!.getWorldPosition(new Vector3())).x);
        const [left,right]=arms();expect(left).toBeLessThan(Math.min(...knees)-.018);expect(right).toBeGreaterThan(Math.max(...knees)+.018);
        const toes=worldPoint('pelvic:partner-left-foot');expect(toes.y).toBeCloseTo(model.root.position.y+.052*frame.scale,5);
        expect(torso.rotation.x).toBeLessThan(-.65);
        const head=worldPoint('pelvic:partner-head');expect(head.y).toBeGreaterThan(model.mesh.skeleton.getBoneByName('Head')!.getWorldPosition(new Vector3()).y+.10);
      }
    }finally{figure.dispose();}
    expect(host.children).toHaveLength(0);
  }finally{pose.restore();disposeMmdModel(model);}
});
