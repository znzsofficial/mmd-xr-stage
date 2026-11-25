import {DefaultMmdRuntime,ThreeMmdLoader,FallbackCore,disposeMmdModel} from '@yohawing/three-mmd-loader';
import {loadCustomBulletMmdModule,createCustomBulletMmdPhysicsBackend} from '@yohawing/three-mmd-loader/physics';
import {Matrix4,Quaternion,Vector3} from 'three';
import {createControllerColliderPhysicsBackend,createPhysicsDiagnosticsBackend} from '../../src/mmdVrShowcase/mmdRuntime/mmdPhysics';
import {createLocalTextureResolver} from '../../src/mmdVrShowcase/mmdRuntime/localTextureResolver';
import {createPoseSolver} from '../../src/mmdVrShowcase/pose/poseSolver';
import {fitRig,skirtWorld} from './rig';
import {makeGpu} from './gpu';
import {trackedGrip} from './handMotion.js';
import {hemSites,takeAt,takeLength,takePalms} from './danceTake.js';
import {getMmdAnimationDurationSeconds} from '../../src/mmdVrShowcase/mmdRuntime/mmdUtils';
import {bakeHeldThigh} from './heldThigh';
import {bulletScriptPath} from '../../src/mmdImport/bulletAsset';

let bullet;
const moduleForLab=()=>bullet??=loadCustomBulletMmdModule({scriptUrl:new URL('/'+bulletScriptPath,location.href).href}).catch(e=>{bullet=null;throw e;});

export async function loadActor(device,format,pmx,files){
  const counts={bodies:0,joints:0,worldMs:0},hands=[new Vector3(0,-100,0),new Vector3(0,-100,0)],matrices=hands.map(()=>new Matrix4().elements);
  let model,solver,gpu,rig,mode='gpu',stepDt=0,raised=false,stroke=null,reseed=true,disposed=false;
  const native=createCustomBulletMmdPhysicsBackend(await moduleForLab(),{fixedTimeStep:1/60,maxSubSteps:2,onStepWork:(_f,t,_o,seed)=>{counts.worldMs=seed?null:t;}});
  const inner=createControllerColliderPhysicsBackend(createPhysicsDiagnosticsBackend(native,()=>stepDt,undefined,()=>.1),()=>matrices,.55);
  let filter;const backend={name:'cloth comparison',disabled:false,get disposed(){return native.disposed;},step(c){return (filter??=skirtWorld(inner,rig,()=>mode,counts)).step(c);},reset:c=>inner.reset(c),dispose:()=>inner.dispose()};
  const runtime={physics:'external',physicsBackend:backend,captureStageSnapshots:false,coalescePhysicsWorldUpdates:true};
  function dispose(){disposed=true;try{solver?.dispose();}finally{gpu?.dispose();if(model)disposeMmdModel(model);if(!native.disposed)native.dispose();}}
  try{
    const loader=new ThreeMmdLoader({core:new FallbackCore(),textureResolver:createLocalTextureResolver(pmx,files),runtime,runtimeFactory:()=>new DefaultMmdRuntime(runtime)});
    model=await loader.loadModel(pmx,{morphSplit:false,morphAttributes:false,outline:false,materialRenderOrder:false});rig=fitRig(model.mesh);
    const {bones}=model.mesh.skeleton,bind=bones.map(b=>[b.position.clone(),b.quaternion.clone(),b.scale.clone()]);
    solver=createPoseSolver(model,null,0,false);const standing=solver.capture(),up=solver.applyPreset('legsUp')?solver.capture():null;
    solver.apply(standing);let blend=0;const rot=new Quaternion(),other=new Quaternion(),tracks=model.mesh.skeleton.bones.map(b=>solver.animation.boneTracks[b.userData.mmdBoneName||b.name]);
    function movePose(dt){if(!up||blend===Number(raised))return;blend=Math.min(1,Math.max(0,blend+(raised?1:-1)*dt/.85));const u=blend*blend*(3-2*blend);
      tracks.forEach((t,i)=>{const j=i*8;for(let k=0;k<3;k++)t.translations[k]=standing.bones[j+k]+(up.bones[j+k]-standing.bones[j+k])*u;
        rot.fromArray(standing.bones,j+3).slerp(other.fromArray(up.bones,j+3),u).toArray(t.rotations);});}
    gpu=await makeGpu(device,model,rig);await gpu.prepare(format);
    let valid,pendingFit,prep='idle',contactState='off',fitWallMs=null;
    function updateFaces(){contactState='off';if(mode!=='gpu-face')return;if(dance||!up){contactState='unsupported';return;}if(blend!==1){contactState='standby';return;}
      if(prep==='idle'){prep='preparing';const start=performance.now();pendingFit=bakeHeldThigh(model.mesh,rig,()=>!disposed).then(async field=>{
        if(disposed)return;if(field&&await gpu.prepareFaces(field)){valid=field.valid;prep='ready';}else prep='unsupported';
      }).catch(error=>{prep='failed';console.warn('Cloth surface fit:',error);}).finally(()=>{if(!disposed)fitWallMs=Math.round(performance.now()-start);});}
      contactState=prep==='ready'?(valid()?'active':'stale'):prep;}
    const info={particles:rig.nodes.length,handSamples:gpu.handSamples,get faceSamples(){return gpu.faceCount;},get faceSetupWallMs(){return fitWallMs;},pins:rig.nodes.filter(n=>n.pin).length,sourceBodies:model.mesh.userData.mmdPhysics.rigidBodies.length,triangles:model.mesh.geometry.index.count/3,
      textures:[].concat(model.mesh.material).filter(m=>m.map?.image).length};
    function reset(){stroke=null;reseed=true;backend.reset();gpu.resetHands();hands.forEach(h=>h.set(0,-100,0));}
    let dance=null,seconds=0,playing=false,duration=0,take=null,clipId=0,round=0,loadId=0,getSites,clipSites=null;
    const anchors=[new Vector3(),new Vector3()];
    function bindClip(clip){bones.forEach((b,i)=>{const [p,q,s]=bind[i];b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);});
      model.mesh.morphTargetInfluences?.fill(0);model.mesh.updateMatrixWorld(true);model.setAnimation(clip);model.runtime.seek(0);reset();}
    async function loadDance(file){const token=++loadId,clip=await loader.loadAnimation(file);if(disposed||token!==loadId)return;
      const tracks=clip.animation.boneTracks,secondsLong=getMmdAnimationDurationSeconds(clip.animation);
      if(!Number.isFinite(secondsLong)||!(secondsLong>0)||!bones.some(b=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n=>n&&tracks[n]?.frames.length)))throw Error('没有可用于此角色的身体动作轨');
      bindClip(clip);dance=clip;clipId++;duration=secondsLong;seconds=0;playing=false;take=null;clipSites=null;round=0;raised=false;blend=0;}
    function clearDance(){loadId++;dance=null;take=null;playing=false;duration=seconds=0;raised=false;blend=0;solver.apply(standing);bindClip(solver.animation);}
    function restart(){if(!dance)return;seconds=0;model.runtime.seek(0);reset();}
    function toggle(){if(!dance)return;take=null;if(!playing&&seconds>=duration)restart();playing=!playing;}
    function compare(){if(take){take=null;playing=false;return;}if(!dance||duration<8)throw Error('同段对照需要至少 8 秒的身体 VMD');
      getSites??=hemSites(model.mesh,rig);if(!getSites)throw Error('此裙没有两个可对照的前幅落点，可改用手动播放');
      // Isolate both takes from whatever was previously on screen.
      const first=++round%2?'bullet':'gpu';mode=first;bindClip(dance);seconds=0;playing=false;take={round,first,time:0,phase:'dance',sites:clipSites};}
    function pose(){if(dance){toggle();return;}if(!up)throw Error('未能在此模型上拟合抬腿姿势');stroke=null;raised=!raised;}
    function startStroke(){const origin=rig.hemLocal.clone().applyMatrix4(rig.anchor.matrixWorld).multiplyScalar(rig.scale);stroke={origin,t:0};}
    function update(dt,xrHands,poseDelta=dt){
      if(take){if(take.time>=takeLength){if(mode===take.first){mode=mode==='bullet'?'gpu':'bullet';take.time=0;bindClip(dance);}else{take=null;playing=false;}}
        if(take){take.time=Math.min(takeLength,take.time+poseDelta);const state=takeAt(take.time);seconds=state.seconds;take.phase=state.phase;
          if(take.time>=4.6&&!take.sites)take.sites=clipSites=getSites();xrHands=takePalms(take.sites,take.time,anchors);}}
      else if(playing){seconds=Math.min(duration,seconds+poseDelta);if(seconds===duration)playing=false;}
      stepDt=reseed?0:Math.min(dt,1/24);if(!dance)movePose(dt);hands.forEach((h,i)=>trackedGrip(xrHands?.[i])?h.copy(xrHands[i]):h.set(0,-100,0));
      if(!xrHands&&stroke){stroke.t+=dt;const t=stroke.t,h=hands[1],rise=Math.min(1,Math.max(0,(t-.45)/.55));h.copy(stroke.origin);h.y+=-.13+.25*rise;h.z+=.24*(1-Math.min(1,t/.45))-.035+.07*rise+.28*Math.max(0,(t-1.18)/.42);if(t>1.65)stroke=null;}
      for(let i=0;i<2;i++){const v=hands[i],m=matrices[i];m[12]=v.x/rig.scale;m[13]=v.y/rig.scale;m[14]=-v.z/rig.scale;}
      counts.worldMs=null;model.update(seconds,{physics:true,ik:!!dance});gpu.update(hands,mode.startsWith('gpu'));updateFaces();}
    return {gpu,rig,model,info,counts,hands,update,pose,startStroke,dispose,reset,loadDance,clearDance,toggle,compare,
      cancelTake(){if(take){take=null;playing=false;reset();}},get clipId(){return dance?clipId:0;},get duration(){return duration;},get seconds(){return seconds;},
      get playing(){return take?['dance','resume'].includes(take.phase):playing;},get take(){return take;},get faceState(){return contactState;},get pendingFit(){return pendingFit;},
      get raised(){return raised;},get stroking(){return !!stroke;},get mode(){return mode;},set mode(m){if(!['gpu-face','gpu','cut','bullet'].includes(m))throw Error('求解方式无效');take=null;mode=m;reset();},
      takeSeed(){const v=reseed;reseed=false;return v;}};
  }catch(e){dispose();throw e;}
}
