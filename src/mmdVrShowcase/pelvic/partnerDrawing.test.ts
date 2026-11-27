import { disposeMmdModel, ThreeMmdLoader } from '@yohawing/three-mmd-loader';
import { Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { centerZ, tipHeight } from '../play/siliconeProfile';
import { poseFixture } from '../pose/poseFixture.testSupport';
import { createPoseSolver } from '../pose/poseSolver';
import { createPelvicSolver, defaultPelvicCalibration as c, registerPelvicSocket, samplePelvicFrame } from './geometry';
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

it.each([[.64,-.82],[1.52,1.29]])('fits the displayed spine, shoulders and each leg at scale %s and yaw %s',async(scale,yaw)=>{
  const model=await new ThreeMmdLoader().loadModel(poseFixture().pmx,{outline:false});
  const host=new Group();host.position.set(.3,-.41,.6);host.rotation.y=.47;host.scale.setScalar(.79);
  model.root.position.set(-1.1,.22,.4);model.root.scale.setScalar(scale);model.root.rotation.y=yaw;
  const pose=createPoseSolver(model,null,0),socket=registerPelvicSocket(model.root,c)!;
  const figure=createPartnerDrawing(host,model.root,socket.anchor);
  const bone=(name:string)=>model.mesh.skeleton.getBoneByName(name)!.getWorldPosition(new Vector3());
  const part=(name:string)=>figure.group.getObjectByName('pelvic:partner-'+name)!;
  const point=(name:string)=>part(name).getWorldPosition(new Vector3());
  const axis=(name:string,x:number,y:number,z:number)=>new Vector3(x,y,z).applyQuaternion(part(name).getWorldQuaternion(new Quaternion()));
  const ground=model.root.position.y;
  const evaluate=()=>model.update(0,{physics:false,ik:false});
  const frame=()=>samplePelvicFrame(socket,c)!;
  function draw(depth:number){const f=frame();figure.draw(f,pelvicRailMatrix(f,depth),ground);}
  function metrics(){return ['head','left-hand','right-hand','left-foot','right-foot'].map(point);}
  function clearance(id:string){
    const vertex=new Vector3();
    let support=Infinity;
    figure.group.updateWorldMatrix(true,true);
    figure.group.traverse(node=>{
      if(!(node instanceof Mesh)||node.parent===figure.piece)return;
      const positions=node.geometry.attributes.position;let bottom=Infinity;
      for(let i=0;i<positions.count;i++)bottom=Math.min(bottom,vertex.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld).y);
      expect((bottom-ground)/scale,`${id}: ${node.name}`).toBeGreaterThan(-.002);
      if(node.name.endsWith('-foot')||node.name.endsWith('-shin'))support=Math.min(support,bottom);
    });
    expect((support-ground)/scale,`${id}: lowest foot or shin`).toBeLessThan(.04);
  }
  try{
    expect(pose.applyPreset('sideLegLift')).toBe(true);evaluate();
    const original=pose.capture(),before=model.mesh.skeleton.bones.map(b=>b.matrixWorld.clone());
    const headward=bone('Neck').sub(bone('LeftThigh').lerp(bone('RightThigh'),.5)).normalize();
    const across=bone('LeftArm').sub(bone('RightArm')).normalize();
    const front=across.clone().cross(headward).normalize();
    const rail=createPelvicSolver(),shown=createPelvicSolver();let admitted=false;
    for(const depth of [-.045,-.02,-.004,.003,.015,.028,.004,-.012]){
      const f=frame(),m=pelvicRailMatrix(f,depth);figure.draw(f,m,ground);
      const reference=rail.step(f,m,{dt:1/60}),actual=shown.step(f,figure.piece.matrixWorld,{dt:1/60});
      expect(actual.motion).toBe(reference.motion);expect(actual.outletInside).toBe(reference.outletInside);
      expect(actual.depthM).toBeCloseTo(reference.depthM,7);expect(actual.outletLocal.distanceTo(reference.outletLocal)).toBeLessThan(1e-7);
      admitted||=actual.outletInside;
      expect(axis('torso',0,1,0).dot(headward)).toBeGreaterThan(.84);
      expect(Math.abs(axis('torso',1,0,0).y)).toBeGreaterThan(.93);
      expect(axis('pelvis',0,0,-1).dot(front)).toBeLessThan(-.93);
      expect(point('head').sub(bone('Head')).dot(front)/f.scale).toBeGreaterThan(.18);
      clearance('sideLegLift');
    }
    expect(admitted).toBe(true);
    model.mesh.skeleton.bones.forEach((b,i)=>expect(b.matrixWorld.elements).toEqual(before[i].elements));

    draw(0);const baseline=metrics();
    expect(pose.move('leftFoot',bone('LeftFoot').addScaledVector(front,.28*scale).addScaledVector(headward,.22*scale))).toBe(true);
    evaluate();draw(0);
    expect(point('right-hand').distanceTo(baseline[2])/scale).toBeGreaterThan(.015);
    expect(point('left-hand').distanceTo(baseline[1])/scale).toBeLessThan(.00001);
    pose.apply(original);evaluate();draw(0);
    metrics().forEach((p,i)=>expect(p.distanceTo(baseline[i])/scale).toBeLessThan(1e-5));

    for(const id of ['allFours','forearmKneel','proneKneeOut'] as const){
      expect(pose.applyPreset(id)).toBe(true);evaluate();draw(.025);
      const hips=bone('LeftThigh').lerp(bone('RightThigh'),.5),heading=bone('Neck').sub(hips).setY(0).normalize();
      expect(axis('pelvis',0,0,-1).dot(heading),id).toBeGreaterThan(.95);
      expect(point('pelvis').sub(hips).dot(heading)/scale,id).toBeLessThan(-.10);
      if(id==='allFours'||id==='forearmKneel'){
        const right=bone('RightThigh').sub(bone('LeftThigh')).normalize();
        for(const [side,actorSide,sign] of [['left','Left',-1],['right','Right',1]] as const){
          const waist=bone(actorSide+'Thigh').lerp(bone(actorSide+'Arm'),.2);
          const brace=point(side+'-hand').sub(waist);
          expect(brace.dot(right)*sign/scale).toBeGreaterThan(.04);
          expect(brace.length()/scale).toBeLessThan(.26);
        }
      }
      clearance(id);
    }
    for(const id of ['sideForwardLeg','halfKneel','supineKneeHug'] as const){
      expect(pose.applyPreset(id)).toBe(true);evaluate();draw(.025);clearance(id);
      if(id==='halfKneel')expect(Math.abs(axis('torso',1,0,0).y)).toBeLessThan(.15);
      if(id==='supineKneeHug')expect(Math.abs(point('right-hand').y-point('left-hand').y)/scale).toBeGreaterThan(.08);
      if(id==='sideForwardLeg'){
        const hips=bone('LeftThigh').lerp(bone('RightThigh'),.5),up=bone('Neck').sub(hips).normalize();
        expect(axis('torso',0,1,0).dot(up)).toBeGreaterThan(.84);
        const arm=point('right-hand'),a=bone('LeftThigh'),d=bone('LeftKnee').sub(a);
        a.addScaledVector(d,Math.max(0,Math.min(1,arm.clone().sub(a).dot(d)/d.lengthSq())));
        expect(a.distanceTo(arm)/scale).toBeGreaterThan(.11);
      }
    }
    pose.apply(original);evaluate();draw(0);
    metrics().forEach((p,i)=>expect(p.distanceTo(baseline[i])/scale).toBeLessThan(1e-5));
  }finally{figure.dispose();pose.restore();disposeMmdModel(model);}
});

it('turns continuously through a partially rolled manual frame, reverses the edit and starts fresh after a cut',()=>{
  // An explicitly registered actor need not have *any* identifiable bones.
  const actor=new Group(),host=new Group(),manual={...c,pitchDeg:0,yawDeg:0,manual:{origin:[0,0,0] as const,unitsPerMeter:1}};
  const socket=registerPelvicSocket(actor,manual)!,figure=createPartnerDrawing(host,actor,socket.anchor);
  const tilted=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/4),sky=new Vector3(0,1,0);
  actor.position.set(2,.55,-3);
  function draw(degrees:number){
    actor.quaternion.copy(tilted).multiply(new Quaternion().setFromAxisAngle(sky,degrees*Math.PI/180));
    const f=samplePelvicFrame(socket,manual)!;figure.draw(f,pelvicRailMatrix(f,.015),0);
    return figure.group.getObjectByName('pelvic:partner-torso')!.getWorldQuaternion(new Quaternion());
  }
  try{
    const headings=[];
    for(let degrees=309;degrees<=328;degrees++){
      const q=draw(degrees);
      if(headings.length)expect(q.angleTo(headings[headings.length-1])).toBeLessThan(.13);
      headings.push(q);
    }
    for(let degrees=328;degrees>=309;degrees--)expect(draw(degrees).angleTo(headings[degrees-309])).toBeLessThan(1e-6);
    for(let degrees=309;degrees<=328;degrees++)draw(degrees);
    actor.position.x+=3;
    const first=draw(328);figure.group.visible=false;
    expect(draw(328).angleTo(first)).toBeLessThan(1e-6);
  }finally{figure.dispose();}
});

it('follows the displayed VMD at upright scale without feeding transforms back to the evaluator',async()=>{
  const files=poseFixture(),loader=new ThreeMmdLoader(),model=await loader.loadModel(files.pmx,{outline:false});
  const socket=registerPelvicSocket(model.root,c)!,figure=createPartnerDrawing(new Group(),model.root,socket.anchor);
  const part=(n:string)=>figure.group.getObjectByName('pelvic:partner-'+n)!;
  model.root.rotation.y=.41;model.root.position.y=.2;
  try{
    model.setAnimation(await loader.loadAnimation(files.vmd));
    let first:Vector3|undefined;
    for(const t of [.12,1.68,.12]){
      model.update(t,{physics:false});model.root.updateWorldMatrix(true,true);
      const bones=model.mesh.skeleton.bones,raw=bones.map(b=>b.matrixWorld.clone());
      const f=samplePelvicFrame(socket,c)!;figure.draw(f,pelvicRailMatrix(f,.02),.2);
      const up=new Vector3(0,1,0).applyQuaternion(part('torso').getWorldQuaternion(new Quaternion()));
      const head=part('head').getWorldPosition(new Vector3());
      expect(up.y).toBeGreaterThan(.85);
      bones.forEach((b,i)=>expect(b.matrixWorld.elements).toEqual(raw[i].elements));
      if(!first)first=head;
      else if(t===.12)expect(head.distanceTo(first)).toBeLessThan(1e-6);
      else expect(head.distanceTo(first)).toBeGreaterThan(.07);
    }
  }finally{figure.dispose();disposeMmdModel(model);}
});
