import {DefaultMmdRuntime,ThreeMmdLoader,FallbackCore,disposeMmdModel} from '@yohawing/three-mmd-loader';
import {loadCustomBulletMmdModule,createCustomBulletMmdPhysicsBackend} from '@yohawing/three-mmd-loader/physics';
import {Matrix4,Quaternion,Vector3} from 'three';
import {createControllerColliderPhysicsBackend,createPhysicsDiagnosticsBackend} from '../../src/mmdVrShowcase/mmdRuntime/mmdPhysics';
import {createLocalTextureResolver} from '../../src/mmdVrShowcase/mmdRuntime/localTextureResolver';
import {createPoseSolver} from '../../src/mmdVrShowcase/pose/poseSolver';
import {fitRig,skirtWorld} from './rig';
import {makeGpu} from './gpu';

let bullet;
const moduleForLab=()=>bullet??=loadCustomBulletMmdModule({scriptUrl:new URL('/mmd/0.8.6/mmd_bullet.js',location.href).href}).catch(e=>{bullet=null;throw e;});

export async function loadActor(device,format,pmx,files){
  const counts={bodies:0,joints:0,worldMs:0},hands=[new Vector3(0,-100,0),new Vector3(0,-100,0)],matrices=hands.map(()=>new Matrix4().elements);
  let model,solver,gpu,rig,mode='gpu',stepDt=0,raised=false,stroke=null,reseed=true;
  const native=createCustomBulletMmdPhysicsBackend(await moduleForLab(),{fixedTimeStep:1/60,maxSubSteps:2,onStepWork:(_f,t,_o,seed)=>{counts.worldMs=seed?null:t;}});
  const inner=createControllerColliderPhysicsBackend(createPhysicsDiagnosticsBackend(native,()=>stepDt,undefined,()=>.1),()=>matrices,.55);
  let filter;const backend={name:'cloth comparison',disabled:false,get disposed(){return native.disposed;},step(c){return (filter??=skirtWorld(inner,rig,()=>mode,counts)).step(c);},reset:c=>inner.reset(c),dispose:()=>inner.dispose()};
  const runtime={physics:'external',physicsBackend:backend,captureStageSnapshots:false,coalescePhysicsWorldUpdates:true};
  function dispose(){try{solver?.dispose();}finally{gpu?.dispose();if(model)disposeMmdModel(model);if(!native.disposed)native.dispose();}}
  try{
    const loader=new ThreeMmdLoader({core:new FallbackCore(),textureResolver:createLocalTextureResolver(pmx,files),runtime,runtimeFactory:()=>new DefaultMmdRuntime(runtime)});
    model=await loader.loadModel(pmx,{morphSplit:false,morphAttributes:false,outline:false,materialRenderOrder:false});rig=fitRig(model.mesh);
    solver=createPoseSolver(model,null,0,false);const standing=solver.capture(),up=solver.applyPreset('legsUp')?solver.capture():null;
    solver.apply(standing);let blend=0;const rot=new Quaternion(),other=new Quaternion(),tracks=model.mesh.skeleton.bones.map(b=>solver.animation.boneTracks[b.userData.mmdBoneName||b.name]);
    function movePose(dt){if(!up||blend===Number(raised))return;blend=Math.min(1,Math.max(0,blend+(raised?1:-1)*dt/.85));const u=blend*blend*(3-2*blend);
      tracks.forEach((t,i)=>{const j=i*8;for(let k=0;k<3;k++)t.translations[k]=standing.bones[j+k]+(up.bones[j+k]-standing.bones[j+k])*u;
        rot.fromArray(standing.bones,j+3).slerp(other.fromArray(up.bones,j+3),u).toArray(t.rotations);});}
    gpu=await makeGpu(device,model,rig);await gpu.prepare(format);
    const info={particles:rig.nodes.length,pins:rig.nodes.filter(n=>n.pin).length,sourceBodies:model.mesh.userData.mmdPhysics.rigidBodies.length,triangles:model.mesh.geometry.index.count/3,
      textures:[].concat(model.mesh.material).filter(m=>m.map?.image).length};
    function reset(){stroke=null;reseed=true;backend.reset();hands.forEach(h=>h.set(0,-100,0));}
    function pose(){if(!up)throw Error('未能在此模型上拟合抬腿姿势');stroke=null;raised=!raised;}
    function startStroke(){const origin=rig.hemLocal.clone().applyMatrix4(rig.anchor.matrixWorld).multiplyScalar(rig.scale);stroke={origin,t:0};}
    function update(dt,xrHands){stepDt=reseed?0:Math.min(dt,1/24);movePose(dt);hands.forEach((h,i)=>xrHands?.[i]?h.copy(xrHands[i]):h.set(0,-100,0));
      if(!xrHands&&stroke){stroke.t+=dt;const t=stroke.t,h=hands[1],rise=Math.min(1,Math.max(0,(t-.45)/.55));h.copy(stroke.origin);h.y+=-.13+.25*rise;h.z+=.24*(1-Math.min(1,t/.45))-.035+.07*rise+.28*Math.max(0,(t-1.18)/.42);if(t>1.65)stroke=null;}
      for(let i=0;i<2;i++){const v=hands[i],m=matrices[i];m[12]=v.x/rig.scale;m[13]=v.y/rig.scale;m[14]=-v.z/rig.scale;}
      counts.worldMs=null;model.update(0,{physics:true,ik:false});gpu.update(hands,mode==='gpu');}
    return {gpu,rig,model,info,counts,hands,update,pose,startStroke,dispose,reset,
      get raised(){return raised;},get stroking(){return !!stroke;},get mode(){return mode;},set mode(m){if(!['gpu','cut','bullet'].includes(m))throw Error('求解方式无效');mode=m;reset();},
      takeSeed(){const v=reseed;reseed=false;return v;}};
  }catch(e){dispose();throw e;}
}
