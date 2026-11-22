import React,{useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {Matrix4,Vector3} from 'three';
import {createMmdRuntimeHandle} from '../src/mmdVrShowcase/mmdRuntime/mmdRuntime';
import {createPropColliderFeed,propColliderShape} from '../src/mmdVrShowcase/play/propColliders';
import {PlayPiece} from '../src/mmdVrShowcase/play/HeldPlay';
import {poseWristToy} from '../src/mmdVrShowcase/play/wristSocket';
import {clothSmokeFixture} from './cloth-smoke-fixture.js';

const dt=1/60, heldTime=2, status=document.querySelector('#status');
const check=(ok,msg,data)=>{if(!ok)throw Error(msg+': '+JSON.stringify(data));};
async function run(scene,camera,group){
  const rows=[], hidden=Array.from({length:14},()=>new Matrix4().makeTranslation(0,-1000,0));
  for(const [toy,scale] of [['wand',1],['dildo',.65]]){
    const feed=createPropColliderFeed(),owner={toy,hand:'right',tilt:0,inset:0,turn:0},root=group[toy];
    let seeds=0,controllerManifolds=0;
    const rt=createMmdRuntimeHandle(scene,{controllerColliders:()=>hidden.slice(0,2),handColliders:()=>hidden.slice(2),
      propColliders:feed.getMatrices,propShape:propColliderShape,onBulletStepWork(_f,_w,_o,seed){if(seed)seeds++;}});
    try{
      const {pmx,vmd}=clothSmokeFixture(true);
      const {modelId}=await rt.addModel(pmx,[pmx],{physics:true,transform:{scale,positionX:.31,positionZ:-.42,rotationY:28}});
      await rt.loadMotion(vmd,'body',modelId);
      const model=rt.getModelRoot(modelId),arm=model.getObjectByName('RightHand'),hem=model.getObjectByName('hem'),mesh=rt.getModelSurface(modelId).mesh;
      const step=()=>{feed.sample(scene,root,null,owner);rt.update(heldTime,true,camera,1,false,dt);controllerManifolds+=rt.getControllerContactCount();};
      const pos=o=>o.getWorldPosition(new Vector3());
      const vertex=()=>mesh.getVertexPosition(2,new Vector3()).applyMatrix4(mesh.matrixWorld);
      // Pose first through the same wrist socket used on screen. Then exercise
      // a reproducible independent sweep of that mounted, rotated piece.
      root.visible=false;step();poseWristToy(root,model,owner);check(root.visible,'missing wrist',toy);
      const wristGrip=root.position.toArray();root.rotation.set(-.13,.42,.23);
      const targetNode=root.getObjectByName(toy==='wand'?'wand:flex':'play:piece:dildo');
      const local=toy==='wand'?new Vector3(0,.0468,0):new Vector3(0,.099,-.0132);
      function moveTo(point){root.position.add(point.clone().sub(targetNode.localToWorld(local.clone())));}
      moveTo(pos(hem).add(new Vector3(0,-.36,0)));for(let i=0;i<90;i++)step();
      const arm0=arm.matrixWorld.clone(),before=pos(hem),v0=vertex(),seed0=seeds;
      const stroke=(n,offset,travel)=>{for(let i=0;i<=n;i++){
        moveTo(before.clone().add(new Vector3(0,offset+travel*i/n,0)));step();
      }};
      stroke(90,-.31,.33);const lift=pos(hem).y-before.y,skinLift=vertex().y-v0.y;
      const armDrift=Math.max(...arm.matrixWorld.elements.map((x,i)=>Math.abs(x-arm0.elements[i])));
      root.visible=false;for(let i=0;i<120;i++)step();const rest=pos(hem);
      // Reappear *inside* the garment. Until withdrawn there is no live prop.
      root.visible=true;moveTo(rest);let reentry=0;for(let i=0;i<24;i++){step();reentry=Math.max(reentry,pos(hem).distanceTo(rest));}
      // Heel first: turn over the piece in clear space. Its tip is *below*
      // the garment throughout this second stroke, so a tip-only proxy fails.
      moveTo(rest.clone().add(new Vector3(0,-.6,0)));step();root.rotation.z+=Math.PI;
      const piece=root.getObjectByName('play:piece:'+toy),heel=new Vector3(0,toy==='wand'?-.062:-.041,0);
      const heelTo=point=>root.position.add(point.clone().sub(piece.localToWorld(heel.clone())));
      for(let i=0;i<20;i++){heelTo(rest.clone().add(new Vector3(0,-.34,0)));step();}
      const heel0=vertex();for(let i=0;i<=75;i++){heelTo(rest.clone().add(new Vector3(0,-.34+.35*i/75,0)));step();}
      const heelLift=vertex().y-heel0.y, tipBelowHem=pos(hem).y-targetNode.localToWorld(local.clone()).y;
      const extraSeeds=seeds-seed0, row={toy,scale,wristGrip,lift,skinLift,heelLift,tipBelowHem,armDrift,controllerManifolds,extraSeeds,reentry,fall:before.y+lift-rest.y,bodies:rt.getRigidBodyCount()};rows.push(row);
      check(lift>.06&&skinLift>.06&&heelLift>.06&&tipBelowHem>.12*scale+.03&&row.fall>.055&&armDrift<1e-6&&controllerManifolds===0&&extraSeeds===0&&reentry<.005&&row.bodies===24,'cloth/diagnostic regression',row);

      // Actual animated wrist on screen: give the same piece to the carrier
      // and put a second independent garment in the path of its VMD upstroke.
      feed.clear();const other=clothSmokeFixture().pmx;
      const {modelId:target}=await rt.addModel(other,[other],{physics:true,transform:{scale,positionX:3}});
      const otherHem=rt.getModelRoot(target).getObjectByName('hem'),tick=t=>rt.update(t,true,camera,1,false,dt);
      for(let i=0;i<100;i++)tick(0);poseWristToy(root,model,owner);
      const start=targetNode.localToWorld(local.clone());
      rt.setModelTransform(target,{positionX:start.x,positionZ:start.z,positionY:start.y+.30*scale-pos(otherHem).y});rt.resetPhysics(0,target);
      const wristStep=t=>{poseWristToy(root,model,owner);feed.sample(scene,root,null,owner);tick(t);poseWristToy(root,model,owner);};
      for(let i=0;i<100;i++)wristStep(0);const other0=pos(otherHem);
      for(let i=0;i<=130;i++)wristStep(i*dt);
      row.wristLift=pos(otherHem).y-other0.y;row.wristTravel=targetNode.localToWorld(local.clone()).y-start.y;
      check(row.wristLift>.04&&row.wristTravel>.36*scale,'VMD wrist / second garment',row);
    }finally{rt.dispose();}
  }
  return rows;
}
function Harness(){const {scene,camera}=useThree(),a=useRef(),b=useRef();
  useEffect(()=>{run(scene,camera,{wand:a.current,dildo:b.current}).then(r=>status.textContent='PASS '+JSON.stringify(r),e=>{status.textContent='FAIL '+e.stack;console.error(e);});},[]);
  return <><group ref={a}><PlayPiece toy="wand"/></group><group ref={b}><PlayPiece toy="dildo"/></group></>;
}
createRoot(document.querySelector('#root')).render(<Canvas><Harness/></Canvas>);
