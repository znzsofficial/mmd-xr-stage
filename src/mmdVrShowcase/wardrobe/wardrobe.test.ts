import { BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, PerspectiveCamera, Scene, Skeleton, SkinnedMesh } from 'three';
import { ThreeMmdLoader, type ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { afterEach, expect, it, vi } from 'vitest';
import { clearBackpack, syncBackpackFiles, useBackpack } from '../backpack';
import { DEFAULT_BODY_PROFILE } from '../bodyState/data';
import { createMmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import { DEFAULT_MATERIAL_OVERRIDE } from '../mmdRuntime/mmdRuntimeMaterials';
import { useMmdVrStore } from '../mmdVrStore';
import { enablePelvic, patchPelvic, usePelvic } from '../pelvic/store';
import { editWardrobe, restoreOutfit } from './actions';
import { wardrobeCatalog, wardrobeKind } from './catalog';
import { configureDraws, presentDraws, restoreDraws } from './draws';
import { createWardrobeModel, resumeWardrobeModel } from './model';

const mat=(name:string)=>new MeshBasicMaterial({name});
function actorMesh(){
  const geometry=new BufferGeometry(),mesh=new SkinnedMesh(geometry,[mat('blouse'),mat('skin'),mat('HairClip')]);
  geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(72),3));
  for(let i=0;i<3;i++)geometry.addGroup(i*3,3,i);
  const delta=new Float32BufferAttribute([0,.25,0],3);
  const split=new SkinnedMesh(new BufferGeometry());split.geometry.morphAttributes.position=[delta];
  split.userData.mmdMorphSplitBody={materialIndex:0,morphTargetIndices:[2]};split.morphTargetInfluences=[.36];
  mesh.userData.mmdMorphs=[{type:'bone'},{type:'vertex'},{name:'襟',englishName:'Lift Blouse',type:'vertex'}];
  mesh.userData.mmdMorphSplitBodyMeshes=[split];mesh.morphTargetDictionary={Dress:0,Smile:1,'襟':2,'Lift Blouse':2};
  mesh.morphTargetInfluences=[.5,.7,.34];return {mesh,split};
}

it('keeps mixed aliases and facial morphs out of the short list; duplicate materials have distinct source-slot keys',()=>{
  const {mesh}=actorMesh();const mixed=mat('shirt');mixed.userData.mmdMaterial={englishName:'Body atlas'};
  mesh.material.push(mixed,mat('jacket'),mat(' jacket '),mat('metal'),mat('mat00001'));
  for(let i=3;i<8;i++)mesh.geometry.addGroup(i*3,3,i);
  expect(wardrobeCatalog(mesh).map(p=>[p.key,p.kind])).toEqual([['blouse','clothing'],['HairClip','accessory'],['jacket [#5]','clothing'],['jacket [#6]','clothing'],['襟','morph']]);
  for(const name of ['body_shirt','眼球_衣装','skin/gloves','Face: hat','肌_靴下','skirtingBoard','hairspray','eyeshadow'])expect(wardrobeKind(name)).toBeNull();
});

it('restores each compact and source channel, follows the next evaluated pose, and retains only numbers for the same File',()=>{
  const file=new File(['a'],'same.pmx'),{mesh,split}=actorMesh(),model=createWardrobeModel(mesh,file);
  model.setWeight('襟',0);model.present();expect(mesh.morphTargetInfluences).toEqual([.5,.7,0]);expect(split.morphTargetInfluences).toEqual([0]);
  const next=actorMesh();expect(resumeWardrobeModel(next.mesh,file)?.weight('襟')).toBe(0);
  expect(resumeWardrobeModel(next.mesh,new File(['a'],'same.pmx'))).toBeUndefined();
  model.restore();expect(split.morphTargetInfluences).toEqual([.36]);mesh.morphTargetInfluences![2]=.76;
  model.present();model.setWeight('襟',null);model.restore();model.present();expect(mesh.morphTargetInfluences![2]).toBe(.76);
  expect(split.morphTargetInfluences).toEqual([.36]);expect(resumeWardrobeModel(next.mesh,file)).toBeUndefined();
});

it('unwinds the body editor above a wardrobe morph on a paused stage and then restores the current dance weight',async()=>{
  const {mesh,split}=actorMesh(),root=new Group(),file=new File(['a'],'actor.pmx');
  mesh.bind(new Skeleton([]));split.bind(mesh.skeleton);root.add(mesh,split);
  const inputs:number[][]=[];
  const spy=vi.spyOn(ThreeMmdLoader.prototype,'loadModel').mockResolvedValue({mesh,root,runtime:{},outlineMeshes:[],renderOrderMeshes:[],diagnostics:{textures:[]},
    update(t:number){inputs.push([mesh.morphTargetInfluences![2],split.morphTargetInfluences![0]]);mesh.morphTargetInfluences![2]=.3+t*.1;}
  } as unknown as ThreeMmdModel);
  const rt=createMmdRuntimeHandle(new Scene());
  try{
    const {modelId:id}=await rt.addModel(file),w=rt.getWardrobe!(id,file)!,cam=new PerspectiveCamera();
    expect(rt.getWardrobe!(id,new File(['a'],'actor.pmx'))).toBeNull();
    w.setWeight('襟',.6);rt.setBodyProfile!(id,{...DEFAULT_BODY_PROFILE,morph:'襟',fullness:.5,cycleGain:0});
    for(let i=0;i<3;i++){rt.update(1,false,cam,1,false,0);expect(split.morphTargetInfluences![0]).toBeCloseTo(.8);}
    expect(inputs).toEqual([[.34,.36],[.4,.36],[.4,.36]]);
    rt.setBodyProfile!(id,null);w.setWeight('襟',null);rt.update(2,false,cam,1,false,0);
    expect(mesh.morphTargetInfluences![2]).toBe(.5);expect(split.morphTargetInfluences![0]).toBe(.36);
  }finally{rt.dispose();spy.mockRestore();}
});

it('composes opacity and visibility after a fresh evaluated body, shadow and outline without multiplying the previous frame',()=>{
  const skin=mat('skin'),cloth=mat('coat'),mesh=new SkinnedMesh(new BufferGeometry(),[skin,cloth]);
  const shadow=mat('shadow'),edge=mat('edge'),proxy=new SkinnedMesh(new BufferGeometry(),shadow),outline=new SkinnedMesh(new BufferGeometry(),edge);
  proxy.userData.mmdMaterialRenderProxy={materialIndex:1};outline.userData.mmdOutlineProxy={sourceMaterialIndex:1};
  cloth.opacity=.6;edge.opacity=.75;shadow.colorWrite=false;const override={...DEFAULT_MATERIAL_OVERRIDE,opacity:.5};
  const entry={id:'i',visible:true,model:{mesh,root:new Group(),renderOrderMeshes:[proxy],outlineMeshes:[outline]} as unknown as ThreeMmdModel,materialNames:['skin','coat'],materialVisible:{coat:true},materialOverrides:{coat:override}};
  configureDraws(entry);expect(cloth.opacity).toBe(.3);expect(edge.opacity).toBe(.375);expect(shadow.colorWrite).toBe(false);
  restoreDraws(mesh);cloth.opacity=.8;edge.visible=false;presentDraws(mesh);expect(cloth.opacity).toBe(.4);expect(edge.visible).toBe(false);
  entry.materialVisible.coat=false;configureDraws(entry);for(let i=0;i<2;i++){restoreDraws(mesh);cloth.visible=shadow.visible=edge.visible=true;presentDraws(mesh);expect([cloth,edge,shadow].every(m=>!m.visible)).toBe(true);}
  entry.materialVisible.coat=true;override.opacity=1;configureDraws(entry);expect([cloth.opacity,edge.opacity,shadow.opacity,skin.opacity]).toEqual([.8,.75,1,1]);expect(cloth.depthWrite).toBe(true);
});

afterEach(()=>{clearBackpack();useMmdVrStore.setState({runtimeRef:null,materialModels:{},overlayOpen:false,physicsBusy:false});usePelvic.setState({byAsset:{},active:null,support:{}});});
it('checks current selection and mounted model identity, reads ordinary material edits, undoes only touched fields, and revokes exposure',()=>{
  const file=new File(['a'],'model.pmx');syncBackpackFiles([file]);const id=useBackpack.getState().entries[0].id;
  const a={assetId:id,runtimeId:'r'},live={runtimeId:'r',visible:true,position:[0,0,0] as [number,number,number]};useBackpack.setState({live:{[id]:live},selected:id});
  let model=createWardrobeModel(actorMesh().mesh,file);const old=model,visible=vi.fn(),override=vi.fn();
  const start={name:'blouse',visible:true,opacity:.63,roughness:.4,metallic:.3,emission:.1};
  useMmdVrStore.setState({overlayOpen:true,materialModels:{r:[start,{...start,name:'skin',visible:false}]},runtimeRef:{getWardrobe:(_id,f)=>f===file?model:null,setMaterialVisible:visible,setMaterialOverride:override}});
  enablePelvic(id,true);patchPelvic(id,{clothingClear:true});expect(editWardrobe(a,old,'skin',{visible:true})).toBe(false);
  expect(editWardrobe(a,old,'blouse',{opacity:.5})).toBe(true);expect(override).toHaveBeenLastCalledWith('r','blouse',{opacity:.5});expect(usePelvic.getState().byAsset[id].clothingClear).toBe(false);
  // A separate material editor owns roughness. Restoring the outfit must
  // leave that independent update, the skin, and the prior opacity intact.
  useMmdVrStore.getState().setMaterialParam('r','blouse','roughness',.2);editWardrobe(a,old,'blouse',{visible:false});restoreOutfit(a,old,'undo');
  expect(useMmdVrStore.getState().materialModels.r).toEqual([{...start,roughness:.2},{...start,name:'skin',visible:false}]);
  editWardrobe(a,old,'blouse',{opacity:.5});useMmdVrStore.getState().setMaterialParam('r','blouse','opacity',.74);
  editWardrobe(a,old,'blouse',{visible:false});restoreOutfit(a,old,'original');restoreOutfit(a,old,'undo');
  expect(useMmdVrStore.getState().materialModels.r).toEqual([{...start,opacity:.74,roughness:.2},{...start,name:'skin',visible:false}]);
  model=createWardrobeModel(actorMesh().mesh,file);expect(editWardrobe(a,old,'blouse',{visible:false})).toBe(false);
  useMmdVrStore.setState({physicsBusy:true});expect(editWardrobe(a,model,'blouse',{visible:false})).toBe(false);
  useMmdVrStore.setState({physicsBusy:false});useBackpack.setState({selected:null});expect(editWardrobe(a,model,'blouse',{visible:false})).toBe(false);
  useBackpack.setState({selected:id,live:{[id]:{...live,runtimeId:'other'}}});expect(editWardrobe(a,model,'blouse',{visible:false})).toBe(false);
});
