import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/core/Materials/standardMaterial';
import 'babylon-mmd/esm/Loader/pmxLoader';
import 'babylon-mmd/esm/Loader/mmdOutlineRenderer';
import {VmdLoader} from 'babylon-mmd/esm/Loader/vmdLoader';
import {SdefInjector} from 'babylon-mmd/esm/Loader/sdefInjector';
import {MmdStandardMaterialBuilder} from 'babylon-mmd/esm/Loader/mmdStandardMaterialBuilder';
import {GetMmdWasmInstance} from 'babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance';
import {MmdWasmInstanceTypeSPR} from 'babylon-mmd/esm/Runtime/Optimized/InstanceType/singlePhysicsRelease';
import {MmdWasmRuntime} from 'babylon-mmd/esm/Runtime/Optimized/mmdWasmRuntime';
import {MmdWasmPhysics} from 'babylon-mmd/esm/Runtime/Optimized/Physics/mmdWasmPhysics';
import {MmdWasmAnimation} from 'babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmAnimation';
import 'babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation';
import {MmdStandardMaterialProxy} from 'babylon-mmd/esm/Runtime/mmdStandardMaterialProxy';

export async function candidate(canvas,pmx,files,vmd,on){
  const engine=new Engine(canvas,false,{preserveDrawingBuffer:true,stencil:true,audioEngine:false},false);
  engine.setSize(400,400);engine.getDeltaTime=()=>1000/72; // Built-in Bullet reads the engine clock separately from animation.
  SdefInjector.OverrideEngineCreateEffect(engine);
  const scene=new Scene(engine);scene.clearColor=Color4.FromHexString('#404650ff');scene.ambientColor=new Color3(.52,.52,.52);
  const camera=new FreeCamera('eye',new Vector3(0,10,-37),scene);camera.setTarget(new Vector3(0,10,0));camera.fov=38*Math.PI/180;camera.minZ=.1;camera.maxZ=160;
  new DirectionalLight('key',new Vector3(3,-5,4).normalize(),scene);
  try{
    const wasm=await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
    const rt=new MmdWasmRuntime(wasm,scene,on?new MmdWasmPhysics(scene):null);
    const rootUrl=pmx.webkitRelativePath.slice(0,pmx.webkitRelativePath.lastIndexOf('/')+1);
    const container=await LoadAssetContainerAsync(pmx,scene,{rootUrl,pluginOptions:{mmdmodel:{referenceFiles:files,materialBuilder:new MmdStandardMaterialBuilder(),loggingEnabled:true}}});
    container.addAllToScene();const mesh=container.meshes[0],meta=mesh.metadata;
    const dynamicBones=[...new Set(meta.rigidBodies.filter(b=>b.physicsMode!==0&&meta.bones[b.boneIndex]).map(b=>meta.bones[b.boneIndex].name))];
    const diffuseMaps=meta.materials.filter(m=>m.diffuseTexture?.isReady()).length;
    const model=rt.createMmdModel(mesh,{buildPhysics:on,materialProxyConstructor:MmdStandardMaterialProxy});
    const v=await new VmdLoader(scene).loadFromBufferAsync('body',await vmd.arrayBuffer());
    const anim=new MmdWasmAnimation(v,wasm,scene);model.setRuntimeAnimation(model.createRuntimeAnimation(anim));
    const indices=new Map(model.runtimeBones.map((b,i)=>[b.name,i]));
    // No scene registration: render must not step physics or advance the VMD a second time.
    scene.render();await scene.whenReadyAsync();await rt.playAnimation();
    return {boneCount:model.runtimeBones.length,duration:anim.endFrame/30,dynamicBones,diffuseMaps,
      update(){rt.beforePhysics(1000/72);rt.afterPhysics();meta.skeleton.prepare()},draw:()=>scene.render(),
      xyz(name){const i=indices.get(name);return i===undefined?null:Array.from(model.worldTransformMatrices.subarray(i*16+12,i*16+15))},
      dispose(){scene.dispose();engine.dispose()}};
  }catch(e){scene.dispose();engine.dispose();throw e;}
}
