import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, MeshBasicMaterial, MeshDepthMaterial, RepeatWrapping, SkinnedMesh, Texture } from 'three';
import type { ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { expect, it, vi } from 'vitest';
import { materialSlotKeys } from '../mmdRuntime/materialSlotKey';
import { createGarmentGuard } from '../pelvic/garment';
import { configureDraws, presentDraws, restoreDraws } from './draws';
import { createWardrobeModel, resumeWardrobeModel } from './model';
import { bindSkinMaps } from './skinMaps';

function fixture(file=new File([],'actor.pmx')){
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([2,2,0,2,3,0,3,2,0, -.01,-.01,.02,.01,-.01,.02,0,.01,.02],3))
    .setAttribute('uv',new Float32BufferAttribute([0,0,1,0,1,1,0,0,1,0,1,1],2));
  g.addGroup(0,3,0);g.addGroup(3,3,1);g.setDrawRange(0,0);
  const original=new Texture();original.flipY=false;original.wrapT=RepeatWrapping;original.offset.set(.2,.4);
  const body=new MeshBasicMaterial({name:'body_skin',map:original}),cloth=body.clone(),unused=body.clone();unused.name='empty';
  const mesh=new SkinnedMesh(g,[body,cloth,unused]),root=new Group(),shadow=new MeshBasicMaterial({map:original,colorWrite:false}),edge=new MeshBasicMaterial();
  function proxy(m:MeshBasicMaterial,i:number){const p=new SkinnedMesh(g.clone(),m);p.geometry.setDrawRange(3*i,3);p.userData.mmdMaterialRenderProxy={materialIndex:i};root.add(p);return p;}
  const a=proxy(body,0),b=proxy(cloth,1),shadowDraw=proxy(shadow,1),outline=proxy(edge,1);shadow.userData.mmdShadowOnlyRenderProxy=true;
  const depth=new MeshDepthMaterial({map:original});outline.userData={mmdOutlineProxy:{sourceMaterialIndex:1}};b.customDepthMaterial=depth;root.add(mesh);
  const surface={mesh,root,renderOrderMeshes:[shadowDraw,b,a],outlineMeshes:[outline]},names=materialSlotKeys(mesh.material),key=names[1];
  const model=createWardrobeModel(mesh,file,surface),entry={id:'r',model:surface as unknown as ThreeMmdModel,visible:true,materialNames:names,materialOverrides:{},materialVisible:{[key]:true}};
  return {file,model,entry,mesh,root,surface,key,body,cloth,shadow,edge,depth,original};
}
it('discovers drawable slots only, distinguishes duplicate names, previews/restores the actual mesh and keeps custom classification on this File only',()=>{
  const f=fixture(),{model,key,cloth,body}=f;expect(model.pieces).toEqual([]);
  expect(model.slots.map(s=>[s.key,s.triangles])).toEqual([['body_skin [#1]',1],['body_skin [#2]',1]]);
  model.preview(key);expect(cloth.wireframe).toBe(true);expect(body.wireframe||f.shadow.wireframe||f.edge.wireframe).toBe(false);
  model.preview(null);expect(cloth.wireframe).toBe(false);expect(model.pieces).toEqual([]);
  expect(model.register(key,true)).toBe(true);expect(model.pieces.map(p=>p.key)).toEqual([key]);
  expect(resumeWardrobeModel(f.mesh,f.file,f.surface)?.manual(key)).toBe(true);
  expect(resumeWardrobeModel(f.mesh,new File([],'actor.pmx'),f.surface)).toBeUndefined();
  f.entry.materialVisible[key]=false;configureDraws(f.entry);
  restoreDraws(f.mesh);presentDraws(f.mesh);expect([cloth,f.shadow,f.edge].map(m=>m.visible)).toEqual([false,false,false]);expect(body.visible).toBe(true);
  expect(materialSlotKeys([{name:'same'},{name:'same'},{name:'same [#1]'},{name:'__proto__'}])).toEqual(['same [#1]#','same [#2]','same [#1]','__proto__ [#4]']);
});

it('a saved unrecognised garment updates an existing geometric obstruction guard; only its visible triangle blocks',()=>{
  const f=fixture(),probe=createGarmentGuard(f.root,f.surface),frame={world:new Matrix4(),inverse:new Matrix4(),scale:1,radiusM:.02,lengthM:.09};
  const read=()=>{for(let i=0;i<512;i++){const r=probe(frame);if(r!=='unverified')return r;}throw Error('scan incomplete');};
  expect(read()).toBeUndefined();f.model.register(f.key,true);expect(read()).toBe('garment');expect(probe.blockerName()).toBe(f.key);
  f.entry.materialVisible[f.key]=false;configureDraws(f.entry);expect(read()).toBeUndefined();
  f.entry.materialVisible[f.key]=true;configureDraws(f.entry);expect(read()).toBe('garment');
  f.model.register(f.key,false);expect(read()).toBeUndefined();
});

it('swaps just one UV-matched base map and its shadow draw; cancelling, failing or disposing an in-flight image never overrides the current map',async()=>{
  const f=fixture(),requests:{resolve:(m:Texture)=>void;reject:()=>void}[]=[],load=()=>new Promise<Texture>((resolve,reject)=>requests.push({resolve,reject}));
  const skins=bindSkinMaps(f.file,f.model.slots,load),a=new File([],'same.png'),b=new File([],'same.png');
  const map=()=>{const t=new Texture();vi.spyOn(t,'dispose');return t;},first=map(),late=map(),retired=map(),second=map();
  const v=skins.select(f.key,a);requests[0].resolve(first);expect(await v).toBe(true);
  expect(first.flipY).toBe(false);expect(first.wrapT).toBe(RepeatWrapping);expect(first.offset.toArray()).toEqual([.2,.4]);
  for(const m of [f.cloth,f.shadow,f.depth])expect(m.map).toBe(first);expect(f.body.map).toBe(f.original);expect(f.edge.map).toBeNull();
  const stale=skins.select(f.key,b);await skins.select(f.key,a);requests[1].resolve(late);expect(await stale).toBe(false);expect(late.dispose).toHaveBeenCalledOnce();
  const fail=skins.select(f.key,b);requests[2].reject();expect(await fail).toBe(false);expect(f.cloth.map).toBe(first);expect(skins.status(f.key).error).toBe(true);
  const change=skins.select(f.key,b);requests[3].resolve(second);await change;expect(first.dispose).toHaveBeenCalledOnce();
  expect(skins.status(f.key).choices).toEqual([a,b]);expect(skins.status(f.key).active).toBe(b);
  const next=fixture(),reloaded=map(),reload=vi.fn(async(_file:File)=>reloaded),resumed=bindSkinMaps(f.file,next.model.slots,reload);
  await Promise.resolve();expect(reload).toHaveBeenCalledWith(b);expect(next.cloth.map).toBe(reloaded);expect(next.body.map).toBe(next.original);
  resumed.dispose();expect(reloaded.dispose).toHaveBeenCalledOnce();expect(next.cloth.map).toBe(next.original);
  await skins.select(f.key,null);expect(second.dispose).toHaveBeenCalledOnce();expect(f.cloth.map).toBe(f.original);expect(f.depth.map).toBe(f.original);
  const pending=skins.select(f.key,b);skins.dispose();requests[4].resolve(retired);expect(await pending).toBe(false);expect(retired.dispose).toHaveBeenCalledOnce();
  const other=bindSkinMaps(new File([],'actor.pmx'),f.model.slots,load);expect(other.status(f.key).choices).toEqual([]);
});
