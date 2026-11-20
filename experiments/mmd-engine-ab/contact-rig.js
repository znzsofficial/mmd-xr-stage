import {Matrix,Vector3} from '@babylonjs/core/Maths/math.vector';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import 'babylon-mmd/esm/Loader/pmxLoader';
import 'babylon-mmd/esm/Loader/mmdOutlineRenderer';
import {LocalMaterials} from './local-materials';
import {VmdLoader} from 'babylon-mmd/esm/Loader/vmdLoader';
import {MmdStandardMaterialProxy} from 'babylon-mmd/esm/Runtime/mmdStandardMaterialProxy';
import {GetMmdWasmInstance} from 'babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance';
import {MmdWasmInstanceTypeSPR} from 'babylon-mmd/esm/Runtime/Optimized/InstanceType/singlePhysicsRelease';
import {MmdWasmRuntime} from 'babylon-mmd/esm/Runtime/Optimized/mmdWasmRuntime';
import {MmdWasmAnimation} from 'babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmAnimation';
import 'babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation';
import {MmdWasmPhysics} from 'babylon-mmd/esm/Runtime/Optimized/Physics/mmdWasmPhysics';
import {MmdWasmPhysicsRuntimeImpl} from 'babylon-mmd/esm/Runtime/Optimized/Physics/mmdWasmPhysicsRuntimeImpl';
import {RigidBodyConstructionInfo} from 'babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBodyConstructionInfo';
import {MotionType} from 'babylon-mmd/esm/Runtime/Optimized/Physics/Bind/motionType';
import {RigidBody} from 'babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBody';
import {PhysicsSphereShape} from 'babylon-mmd/esm/Runtime/Optimized/Physics/Bind/physicsShape';

// One actor, one native MMD world. Convert the tracking points into model
// coordinates instead of scaling the Bullet constraints or the XR camera.
export async function loadContactRig(scene,pmx,files,vmd,{scale:requestedScale,physics=true}={}){
  const wasm=await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
  const helper=new MmdWasmPhysics(scene);let seconds=0;
  helper.createPhysicsClock=()=>({getDeltaTime:()=>seconds});
  const rt=new MmdWasmRuntime(wasm,null,physics?helper:null);
  let container,animation,shape,info;
  const slots=new Map();const impl=rt.physics?.getImpl(MmdWasmPhysicsRuntimeImpl);
  function drop(id){const s=slots.get(id);if(s?.body){impl.removeRigidBody(s.body,0);s.body.dispose()}slots.delete(id)}
  function resetHands(){for(const id of slots.keys())drop(id)}
  function dispose(){resetHands();info?.dispose();shape?.dispose();rt.dispose(scene);animation?.dispose();container?.dispose()}
  try{
    const dir=pmx.webkitRelativePath.slice(0,pmx.webkitRelativePath.lastIndexOf('/')+1);
    const materials=new LocalMaterials();
    container=await LoadAssetContainerAsync(pmx,scene,{rootUrl:dir,pluginOptions:{mmdmodel:{referenceFiles:files,materialBuilder:materials,loggingEnabled:true}}});
    container.addAllToScene();const mesh=container.meshes[0],meta=mesh.metadata;
    const {min,max}=mesh.getHierarchyBoundingVectors(true);
    const scale=requestedScale??Math.min(10,Math.max(.01,1.65/Math.max(.01,max.y-min.y)));
    const pos=new Vector3(0,-min.y*scale,.70),from=new Vector3(),m=new Matrix(),center=new Vector3();
    let used=0,targets=0;const dynamic=[];
    for(const b of meta.rigidBodies){used|=1<<b.collisionGroup;if(!b.physicsMode)continue;targets|=1<<b.collisionGroup;
      const bone=meta.skeleton.bones[b.boneIndex],off=Vector3.FromArray(b.shapePosition);
      if(bone)Vector3.TransformCoordinatesToRef(off,bone.getAbsoluteInverseBindMatrix(),off);
      const [x,y,z]=b.shapeSize,r=b.shapeType===0?x:b.shapeType===1?Math.hypot(x,y,z):x+y/2;
      dynamic.push({index:b.boneIndex,off,r});}
    let group=0;for(let i=15;i>=0;i--)if(!(used&(1<<i))){group=1<<i;break}
    const masks=meta.rigidBodies.map(b=>b.collisionMask);
    let model;
    try{if(physics&&group)for(const b of meta.rigidBodies)if(b.physicsMode)b.collisionMask|=group;
      model=rt.createMmdModel(mesh,{buildPhysics:physics?{worldId:0}:false,materialProxyConstructor:MmdStandardMaterialProxy});
    }finally{meta.rigidBodies.forEach((b,i)=>{b.collisionMask=masks[i]})}
    if(vmd){const v=await new VmdLoader(scene).loadFromBufferAsync('body',await vmd.arrayBuffer());animation=new MmdWasmAnimation(v,wasm,null);model.setRuntimeAnimation(model.createRuntimeAnimation(animation));}
    const radius=.08/scale;
    if(impl&&group&&targets){shape=new PhysicsSphereShape(impl,radius);info=new RigidBodyConstructionInfo(wasm);info.shape=shape;info.motionType=MotionType.Kinematic;info.mass=0;info.disableDeactivation=true;info.friction=.5;info.collisionGroup=group;info.collisionMask=targets;}
    function clearAt(p){const mats=model.worldTransformMatrices;
      for(const d of dynamic){if(d.index>=0&&d.index*16+15<mats.length){Matrix.FromArrayToRef(mats,d.index*16,m);Vector3.TransformCoordinatesToRef(d.off,m,center)}else center.copyFrom(d.off);
        if(Vector3.DistanceSquared(p,center)<(d.r+radius+.04/scale)**2)return false;}return true;}
    function contact(id,p,dt){if(!p||!info){drop(id);return false}
      p.subtractToRef(pos,from);from.scaleInPlace(1/scale);
      let s=slots.get(id);if(s&&Vector3.DistanceSquared(s.prev,from)>(.4/scale)**2){drop(id);s=null}
      if(!s){s={prev:from.clone(),cool:0,body:null};slots.set(id,s)}s.prev.copyFrom(from);
      if(!s.body){s.cool=clearAt(from)?s.cool+Math.min(dt,1/60):0;if(s.cool+1e-8<2/60)return false;
        info.setInitialTransform(Matrix.TranslationToRef(from.x,from.y,from.z,m));s.body=new RigidBody(impl,info);impl.addRigidBody(s.body,0);
      }else{s.body.setTransformMatrix(Matrix.TranslationToRef(from.x,from.y,from.z,m))}return true;}
    function step(dt){seconds=Math.max(0,Math.min(.05,dt));mesh.position.setAll(0);mesh.scaling.setAll(1);mesh.computeWorldMatrix(true);
      rt.beforePhysics(seconds*1000);rt.afterPhysics();meta.skeleton.prepare(true);
      mesh.position.copyFrom(pos);mesh.scaling.setAll(scale);mesh.computeWorldMatrix(true);}
    step(0);
    return {model,meta,pos,scale,rt,step,contact,resetHands,dispose,missingTextures:materials.missing,canContact:!!info,hasMotion:!!animation,
      get frame(){return rt.currentFrameTime},get playing(){return rt.isAnimationPlaying},
      async play(){if(animation){if(rt.currentFrameTime>=animation.endFrame)await rt.seekAnimation(0);await rt.playAnimation()}},pause:()=>rt.pauseAnimation()};
  }catch(e){dispose();throw e;}
}
