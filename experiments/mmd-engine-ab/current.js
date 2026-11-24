import * as T from 'three';
import {createMmdRuntimeHandle} from '../../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts';
import {prepareMmdVrModel} from '../../src/mmdVrShowcase/stage/loading/prepareMmdVrModel.ts';

export async function current(canvas,pmx,files,vmd,on){
  const renderer=new T.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
  renderer.setSize(400,400,false); renderer.setClearColor(0x404650);
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(38,1,.1,160);
  camera.position.set(0,10,37);camera.lookAt(0,10,0);
  const sun=new T.DirectionalLight(0xffffff,1);sun.position.set(-3,5,4);
  scene.add(sun,new T.AmbientLight(0xffffff,.52));
  const rt=createMmdRuntimeHandle(scene,{prepareModel:prepareMmdVrModel});
  try{
    const {modelId,missingTextures,textureWarnings}=await rt.addModel(pmx,files,{physics:on,transform:{scale:1}});
    rt.setLighting({directionalLight:sun,envIntensity:0,ambientIntensity:.52});
    await rt.loadMotion(vmd,'body',modelId);
    let mesh;rt.getModelRoot(modelId).traverse(o=>{if(!mesh&&o.isSkinnedMesh)mesh=o;});
    const bones=mesh.skeleton.bones,indices=new Map(bones.map((b,i)=>[b.userData.mmdBoneName||b.name,i]));
    const draw=()=>renderer.render(scene,camera);draw();await renderer.compileAsync(scene,camera);
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    return {boneCount:bones.length,duration:rt.duration,diffuseMaps:mats.filter(m=>m.map?.image).length,textureWarnings:(missingTextures?.length??0)+(textureWarnings?.length??0),
      setBalancedColor(balancedModelColor){rt.setLighting({directionalLight:sun,envIntensity:0,ambientIntensity:.52,balancedModelColor});},
      update(frame){rt.update(frame/72,on,camera,1,false,1/72)},draw,
      xyz(name){const i=indices.get(name);return i===undefined?null:bones[i].matrixWorld.elements.slice(12,15)},
      dispose(){rt.dispose();renderer.dispose();renderer.forceContextLoss()}};
  }catch(e){rt.dispose();renderer.dispose();renderer.forceContextLoss();throw e;}
}
