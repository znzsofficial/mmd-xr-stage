import {Vector3} from '@babylonjs/core/Maths/math.vector';
import * as T from 'three';
import {createMmdRuntimeHandle} from '../../src/mmdVrShowcase/mmdRuntime/mmdRuntime';
import {clothSmokeFixture} from '../../scripts/cloth-smoke-fixture';
import {loadContactRig} from './contact-rig';

const dt=1/60;
async function threeFixture(pmx,vmd,scale){
  const a=new T.Matrix4().makeTranslation(0,-1000,0),b=a.clone(),camera=new T.PerspectiveCamera();
  const rt=createMmdRuntimeHandle(new T.Scene(),{controllerColliders:()=>[a,b],controllerColliderRadius:()=>.08});
  try{const {modelId}=await rt.addModel(pmx,[pmx],{physics:true,transform:{scale}});await rt.loadMotion(vmd,'body',modelId);
    const root=rt.getModelRoot(modelId),wrist=root.getObjectByName('RightHand'),hem=root.getObjectByName('hem');
    let skin;root.traverse(o=>{if(o.isSkinnedMesh&&!skin)skin=o});let frame=0;
    return {tick(p,advance){if(p)a.setPosition(p.x,p.y,p.z);else a.setPosition(0,-1000,0);if(advance)frame+=.5;rt.update(frame/30,true,camera,1,false,dt)},
      get frame(){return frame},wrist:()=>[...wrist.matrixWorld.elements],hem:()=>new Vector3(...hem.getWorldPosition(new T.Vector3()).toArray()),
      vertex:()=>new Vector3(...skin.getVertexPosition(2,new T.Vector3()).applyMatrix4(skin.matrixWorld).toArray()),dispose:()=>rt.dispose()};
  }catch(e){rt.dispose();throw e;}
}
async function babylonFixture(scene,pmx,vmd,scale){
  const rig=await loadContactRig(scene,pmx,[pmx],vmd,{scale});rig.pos.setAll(0);await rig.play();
  const skin=rig.meta.meshes.find(m=>m.getTotalVertices()===4),find=n=>rig.model.runtimeBones.findIndex(b=>b.name===n)*16;
  const hi=find('hem'),wi=find('RightHand');let paused=false;
  return {tick(p,advance){if(!advance&&!paused){rig.pause();paused=true}const armed=rig.contact('right',p,dt);rig.step(dt);return armed},
    resume:()=>rig.play(),get frame(){return rig.frame},wrist:()=>Array.from(rig.model.worldTransformMatrices.subarray(wi,wi+16)),
    hem:()=>Vector3.FromArray(rig.model.worldTransformMatrices,hi+12).scaleInPlace(scale),vertex:()=>Vector3.FromArray(skin.getPositionData(true,true),6).scaleInPlace(scale),dispose:()=>rig.dispose()};
}
export async function clothTrial(scene){
  const {pmx,vmd}=clothSmokeFixture(true),rows=[];
  for(const scale of [1,.5])for(const name of ['Three','Babylon'])for(const touch of [false,true]){
    const rig=name==='Three'?await threeFixture(pmx,vmd,scale):await babylonFixture(scene,pmx,vmd,scale);
    try{
      for(let i=0;i<120;i++)rig.tick(null,true);const frozen=rig.frame;
      const p=new Vector3();const tick=(x,y)=>rig.tick(touch&&x!==null?p.set(x*scale,y*scale,0):null,false);
      for(let i=0;i<60;i++)tick(.8,-.02);for(let i=1;i<=60;i++)tick(.8*(1-i/60),-.02);
      const base=rig.vertex(),arm=rig.wrist();for(let i=1;i<=70;i++)tick(0,-.02+.005*i);
      const raised=rig.vertex();for(let i=1;i<=15;i++)tick(i*.006,.33);const swept=rig.vertex();
      for(let i=1;i<=60;i++)tick(.09+i*.012,.33);for(let i=0;i<100;i++)tick(null,0);
      const back=rig.vertex(),overlap=rig.hem();let overlapArms=0,recoveryDrift=0;
      for(let i=0;i<12;i++){overlapArms+=Number(!!rig.tick(touch?overlap:null,false));recoveryDrift=Math.max(recoveryDrift,Vector3.Distance(back,rig.vertex()))}
      for(let i=0;i<4;i++)tick(.8,-.02);const armed=tick(.8,-.02);
      const drift=Math.max(...rig.wrist().map((v,i)=>Math.abs(v-arm[i])));
      const result={name,scale,touch,poseFrame:frozen,lift:raised.y-base.y,side:swept.x-raised.x,residual:Vector3.Distance(back,base),recoveryDrift,armMatrixDrift:drift};rows.push(result);
      if(rig.frame!==frozen||drift>1e-5||overlapArms||recoveryDrift>.025*scale||name==='Babylon'&&armed!==touch)throw Error('恢复／暂停验证失败 '+JSON.stringify(result));
      if(touch?!(result.lift>.035*scale&&result.residual<.035*scale):Math.abs(result.lift)>.008*scale)throw Error('蒙皮衣摆验证失败 '+JSON.stringify(result));
      await rig.resume?.();rig.tick(null,true);if(rig.frame<=frozen)throw Error('动作未恢复');
    }finally{rig.dispose()}
  }
  return rows;
}
