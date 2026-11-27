import { Bone, DirectionalLight, Float32BufferAttribute, Group, MeshToonMaterial, PlaneGeometry, Skeleton, SkinnedMesh, Texture, Uint16BufferAttribute } from 'three';
import { expect, it, vi } from 'vitest';
// @ts-expect-error The optional renderer is a Vite-only JS module.
import { createActorMaterialAdapter } from '../../../scripts/webgpu-actor/materialAdapter.js';
import { bindSkinMaps } from './skinMaps';
import { bindSlots } from './slots';

it('keeps shared PMX atlases independent across attached actors, duplicate slots, a late decode and a remount', async () => {
  const renderer = {init:async()=>{},isWebGPURenderer:true,
    backend:{isWebGPUBackend:true,device:{limits:{maxUniformBufferBindingSize:65536}}},xr:{enabled:true}};
  const adapter = await createActorMaterialAdapter(renderer, new DirectionalLight(), {stageEdits:true});
  const atlas = new Texture(), firstFile = new File([], 'actor.pmx'), otherFile = new File([], 'actor.pmx');
  const skin = new File([], 'skin.png'), pendingFile = new File([], 'skin.png');
  function attach(file: File, load: (f: File)=>Promise<Texture>) {
    const g = new PlaneGeometry();
    g.addGroup(0,3,0); g.addGroup(3,3,1);
    g.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(16),4));
    g.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
    const mats = [0,1].map(()=>new MeshToonMaterial({name:'face',map:atlas}));
    const mesh = new SkinnedMesh(g,mats), bone = new Bone(), model = {root:new Group(),mesh};
    mesh.add(bone);mesh.bind(new Skeleton([bone]));model.root.add(mesh);
    adapter.attach(model,{sparseMorphs:false});
    const slots = bindSlots(mesh), maps = bindSkinMaps(file,slots,load);
    return {maps,slots,mats:mesh.material,close(){adapter.detach(model);maps.dispose();}};
  }
  const one = new Texture(), late = new Texture(), resumed = new Texture();
  let resolve!: (t: Texture)=>void;
  const next = new Promise<Texture>(r=>{resolve=r;});
  const a = attach(firstFile, async f=>f===skin?one:next), b = attach(otherFile,vi.fn());
  const key = a.slots[0].key;
  const sampled = (model: typeof a) => model.mats.map(m=>m.userData.stageMaterial.diffuse.value);
  expect(a.slots.map(s=>[s.key,s.textured])).toEqual([['face [#1]',true],['face [#2]',true]]);
  expect(await a.maps.select(key,skin)).toBe(true);
  expect(sampled(a)).toEqual([one,atlas]);expect(sampled(b)).toEqual([atlas,atlas]);
  expect(b.maps.status(key).choices).toEqual([]);
  const stale = a.maps.select(key,pendingFile);a.close();
  const c = attach(firstFile,async()=>resumed);await Promise.resolve();
  expect(sampled(c)).toEqual([resumed,atlas]);
  const dispose = vi.spyOn(late,'dispose');resolve(late);expect(await stale).toBe(false);
  expect(dispose).toHaveBeenCalledOnce();expect(sampled(c)).toEqual([resumed,atlas]);
  expect(await c.maps.select(key,null)).toBe(true);
  for(const model of [a,b,c])expect(sampled(model)).toEqual([atlas,atlas]);
  b.close();c.close();adapter.dispose();
});
