import { expect, it, vi } from 'vitest';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { inspectActorStyle } from '../../../scripts/webgpu-actor/actorStyleSlots.js';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { createActorStyle } from '../../../scripts/webgpu-actor/actorStyle.js';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { loadActorStyleMaps } from '../../../scripts/webgpu-actor/actorStyleMaps.js';

it('styles named draws even on a shared atlas or without a texture; only matching diffuse families can nominate maps',()=>{
  const material=[['face','face_03_D.png'],['face２','face_03_D.png','Face'],['cloth1','set_cloth_01_D.png'],
    ['裙内','body.png'],['发1','shared.bmp'],['皮革','body.png'],['发饰金属','shared.bmp'],['肌','body.png'],['裙子',''],
    ['Body','body.png'],['白目','face_03_D.png'],['眉睫','face_03_D.png'],['口内','face_03_D.png'],['目影','face_03_D.png'],
    ['Cloth','set_cloth_01_D.png','Eye'],['髪飾り','shared.bmp'],['手套','body.png'],['腿环','body.png'],
    ['金属','body.png','Leather'],['嗨丝','body.png'],['Mat. Hair Alpha','hair.png']]
    .map(([name,texturePath,englishName],i)=>({userData:{mmdMaterial:{name,englishName,materialIndex:i,faceCount:3,texturePath}},
      map:texturePath ? {image:{width:2,height:2}} : null}));
  const {hybridSlots,inputs,hasBase}=inspectActorStyle({mesh:{material}});
  expect(hasBase).toBe(true);
  expect(hybridSlots).toEqual({face:[0],skin:[7],hair:[4,20],cloth:[2,3,8,19],leather:[5],metal:[6]});
  expect(inputs.map((s:{i:number})=>s.i)).toEqual([0,2]);
});

it('lets a Blender-numbered translation corroborate a primary role, not create or override one',()=>{
  const labels=[['面','Face.001'],['顔','ＦＡＣＥ．００２'],['面','Face2'],['面','face_01'],
    ['Face.001','Face'],['表情','face.001'],['睫','Face.001'],['','Face.001'],['面','Eye.001'],
    ['皮革','Leather.001'],['布料','Leather.001'],['','Hair.002'],['unknown','Metal']];
  const material=labels.map(([name,englishName],materialIndex)=>({map:{image:{width:2,height:2}},
    userData:{mmdMaterial:{name,englishName,materialIndex,faceCount:3,texturePath:'set_face_01_D.png'}}}));
  const plan=inspectActorStyle({mesh:{material}});
  expect(plan.hybridSlots.face).toEqual([0,1]);
  expect(plan.hybridSlots.leather).toEqual([9]);expect(plan.hybridSlots.metal).toEqual([12]);
  expect(plan.hybridSlots.cloth).toEqual([]);expect(plan.hybridSlots.hair).toEqual([]);
  expect(plan.inputs.map((s:{i:number})=>s.i)).toEqual([0,1]);
});

function setup(inputs:object[]=[{}]) {
  const result={cloth:new Map([[2,{dispose:vi.fn()}]]),face:new Map()};
  result.cloth.set(8,result.cloth.get(2)!);
  let resolve!:(v:typeof result)=>void, reject!:(e:Error)=>void;
  const promise=new Promise<typeof result>((r,j)=>{resolve=r;reject=j;});
  const pending={resolve,reject,promise};
  const load=vi.fn((_src:object,_inputs:object[],_signal:AbortSignal)=>promise);
  const adapter={prepareStyle:vi.fn(()=>true),setStyle:vi.fn(()=>true)},notify=vi.fn(), model={};
  const style=createActorStyle(model,{}, {hasBase:true,inputs,hybridSlots:{cloth:[2,8]}},adapter,notify,load);
  return {model,notify,style,adapter,load,pending,result};
}

it('prepares one graph on the next displayed frame only for the latest choice; shares file work across rapid presses',async()=>{
  const {style,load,adapter,pending,result,model}=setup();
  expect(load).not.toHaveBeenCalled(); style.choose(true); style.choose(false); style.choose(true); style.choose(false);
  expect(load).toHaveBeenCalledTimes(1); pending.resolve(result); await pending.promise;
  expect(style.snapshot).toMatchObject({mode:'mmd',requested:'mmd',phase:'ready',clothMaps:2});
  style.frame(); expect(adapter.prepareStyle).not.toHaveBeenCalled();
  style.choose(true); expect(adapter.setStyle).not.toHaveBeenCalled(); style.frame(); style.frame();
  expect(style.snapshot.mode).toBe('endfield'); expect(adapter.prepareStyle).toHaveBeenCalledExactlyOnceWith(model,result);
  style.choose(false); style.frame(); expect(adapter.setStyle.mock.calls).toEqual([[model,true],[model,false]]);
  style.dispose(); expect(result.cloth.get(2)!.dispose).toHaveBeenCalledOnce();
});

it('uses the next frame without a decoder for base-only slots, and keeps unrecognized actors on MMD',()=>{
  const {style,load,adapter,model}=setup([]);
  style.choose(true);expect(load).not.toHaveBeenCalled();expect(adapter.prepareStyle).not.toHaveBeenCalled();
  style.frame();expect(style.snapshot).toMatchObject({phase:'ready',mode:'endfield',faceMaps:0,clothMaps:0});
  style.choose(false);style.frame();expect(adapter.setStyle.mock.calls).toEqual([[model,true],[model,false]]);style.dispose();
  const plan=inspectActorStyle({mesh:{material:[{userData:{mmdMaterial:{materialIndex:0,faceCount:3,name:'unknown'}}}]}});
  const unknown=createActorStyle({}, {},plan,adapter,vi.fn(),load);unknown.choose(true);expect(unknown.frame()).toBe(false);
  expect(unknown.snapshot).toMatchObject({phase:'unavailable',requested:'mmd',mode:'mmd'});unknown.dispose();
});

it('falls back to base on missing or unreadable optional maps and honors a return to MMD while loading',async()=>{
  const missing=setup();missing.style.choose(true);missing.pending.resolve({cloth:new Map(),face:new Map()});
  await missing.pending.promise;missing.style.frame();
  expect(missing.style.snapshot).toMatchObject({phase:'ready',mode:'endfield',faceMaps:0,clothMaps:0});missing.style.dispose();
  const bad=setup();bad.style.choose(true);bad.style.choose(false);bad.pending.reject(Error('bad map'));
  await bad.pending.promise.catch(()=>{});expect(bad.style.frame()).toBe(false);expect(bad.adapter.setStyle).not.toHaveBeenCalled();
  bad.style.choose(true);bad.style.frame();expect(bad.style.snapshot).toMatchObject({phase:'ready',mode:'endfield',faceMaps:0,clothMaps:0});
  expect(bad.load).toHaveBeenCalledOnce();bad.style.dispose();
});

it('discards late resources after actor retirement and restores MMD if preparing the graph fails',async()=>{
  const old=setup(); old.style.choose(true); old.style.dispose();
  expect(old.load.mock.calls[0][2].aborted).toBe(true);
  const before=old.notify.mock.calls.length; old.pending.resolve(old.result); await old.pending.promise; old.style.frame();
  expect(old.result.cloth.get(2)!.dispose).toHaveBeenCalledOnce(); expect(old.notify).toHaveBeenCalledTimes(before);
  expect(old.adapter.prepareStyle).not.toHaveBeenCalled();
  const bad=setup(); bad.style.choose(true); bad.pending.resolve(bad.result); await bad.pending.promise;
  bad.adapter.prepareStyle.mockImplementation(()=>{throw Error('unsupported graph')}); bad.style.frame();
  expect(bad.style.snapshot).toMatchObject({phase:'failed',mode:'mmd',requested:'mmd'});
  expect(bad.adapter.setStyle).toHaveBeenCalledExactlyOnceWith(bad.model,false);
  bad.style.dispose(); expect(bad.result.cloth.get(2)!.dispose).toHaveBeenCalledOnce();
});

it('only sends the selected package and resolved diffuse; retiring the actor terminates its decoder',async()=>{
  const fileAt=(path:string)=>Object.defineProperty(new File(['image'],path.split('/').at(-1)!), 'webkitRelativePath',{value:path});
  const a=fileAt('a/model.pmx'), diffuse=fileAt('a/maps/set_cloth_01_D.png');
  const normal=fileAt('a/maps/set_cloth_01_N.png'), other=fileAt('b/maps/set_cloth_01_P.png');
  const foreignDiffuse=fileAt('b/maps/set_cloth_02_D.png');
  const files=[a,diffuse,normal,fileAt('b/model.pmx'),other,foreignDiffuse,fileAt('b/maps/set_cloth_02_N.png'),
    fileAt('a/nested/model.pmx'),fileAt('a/nested/set_cloth_01_P.png')], abort=new AbortController();
  const worker={postMessage:vi.fn(),terminate:vi.fn()}, factory=vi.fn(()=>worker);
  const done=loadActorStyleMaps({file:a,resolver:{resolve:(ref:string)=>ref===diffuse.name?diffuse:foreignDiffuse},companionFiles:files},
    [diffuse,foreignDiffuse].map((f,i)=>({i,role:'cloth',ref:f.name,width:2,height:2})),abort.signal,factory);
  await Promise.resolve();await Promise.resolve();
  const msg=worker.postMessage.mock.lastCall?.[0];expect(msg.files.map((v:{file:File})=>v.file)).toEqual([diffuse,normal]);
  expect(msg.inputs.map((s:{i:number})=>s.i)).toEqual([0]);
  abort.abort(); await expect(done).rejects.toMatchObject({name:'AbortError'}); expect(worker.terminate).toHaveBeenCalledOnce();
  const looseFiles=[a,diffuse,normal].map(f=>new File([f],f.name));
  const loose=await loadActorStyleMaps({file:looseFiles[0],resolver:{resolve:()=>looseFiles[1]},companionFiles:looseFiles},
    [{i:0,role:'cloth',ref:diffuse.name}],new AbortController().signal,factory);
  expect(loose.cloth.size).toBe(0);expect(factory).toHaveBeenCalledOnce();
});
