import { expect, it, vi } from 'vitest';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { inspectActorStyle } from '../../../scripts/webgpu-actor/actorStyleSlots.js';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { createActorStyle } from '../../../scripts/webgpu-actor/actorStyle.js';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { loadActorStyleMaps } from '../../../scripts/webgpu-actor/actorStyleMaps.js';
// @ts-expect-error optional worker-side PNG reader
import { loadStrandMasks } from '../../../scripts/webgpu-actor/strandMasks.js';

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

it('styles labelled sleeve panels without taking trims or other passes on the same atlas',()=>{
  const labels = [
    ['左袖', ''], ['右袖２', ''], ['外袖', 'Outer sleeve'], ['', 'Left Sleeve 2'],
    ['袖飄帶', ''], ['右袖2+', ''], ['袖飾', ''], ['未知', ''],
    ['右袖', 'Eye'], ['眉睫', 'Left sleeve'], ['左袖', 'Metal'], ['未知', 'Left sleeve.001'],
    ['右袖2+', 'Right sleeve'], ['左袖', 'Sleeve trim'], ['まつげ', 'Outer sleeve'],
  ];
  const material = labels.map(([name,englishName], materialIndex) => ({
    userData:{mmdMaterial:{name,englishName,materialIndex,faceCount:3,
      texturePath:materialIndex === 3 ? 'shared.png' : 'set_cloth_01_D.png'}},
    map:{image:{width:2,height:2}},
  }));
  const plan = inspectActorStyle({mesh:{material}});
  expect(plan.hybridSlots).toEqual({face:[],skin:[],hair:[],cloth:[0,1,2,3],leather:[],metal:[]});
  expect(plan.inputs.map((s:{i:number}) => s.i)).toEqual([0,1,2]);
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

function deferred<T>() {
  let resolve!:(value:T)=>void, reject!:(reason:Error)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}

function setup(inputs:object[]=[{}]) {
  const result={cloth:new Map([[2,{dispose:vi.fn()}]]),face:new Map()};
  result.cloth.set(8,result.cloth.get(2)!);
  const pending=deferred<typeof result>();
  const load=vi.fn((_src:object,_inputs:object[],_signal:AbortSignal)=>pending.promise);
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
  expect(style.snapshot.mode).toBe('endfield'); expect(adapter.prepareStyle).toHaveBeenCalledExactlyOnceWith(model,result,'endfield');
  style.choose(false); style.frame(); expect(adapter.setStyle.mock.calls).toEqual([[model,'endfield'],[model,'mmd']]);
  style.dispose(); expect(result.cloth.get(2)!.dispose).toHaveBeenCalledOnce();
});

it('uses the next frame without a decoder for base-only slots, and keeps unrecognized actors on MMD',()=>{
  const {style,load,adapter,model}=setup([]);
  style.choose(true);expect(load).not.toHaveBeenCalled();expect(adapter.prepareStyle).not.toHaveBeenCalled();
  style.frame();expect(style.snapshot).toMatchObject({phase:'ready',mode:'endfield',faceMaps:0,clothMaps:0});
  style.choose(false);style.frame();expect(adapter.setStyle.mock.calls).toEqual([[model,'endfield'],[model,'mmd']]);style.dispose();
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
  expect(bad.adapter.setStyle).toHaveBeenCalledExactlyOnceWith(bad.model,'mmd');
  bad.adapter.prepareStyle.mockReturnValueOnce(true);bad.style.choose('strinova');bad.style.frame();
  expect(bad.style.snapshot).toMatchObject({mode:'strinova',failedModes:['endfield']});
  bad.style.dispose(); expect(bad.result.cloth.get(2)!.dispose).toHaveBeenCalledOnce();
});

it('installs Strinova while Endfield maps are pending and ignores the stale choice when they arrive',async()=>{
  const {style,adapter,pending,result,model}=setup();
  style.choose('endfield');style.choose('strinova');expect(style.frame()).toBe(true);
  expect(style.snapshot).toMatchObject({mode:'strinova',requested:'strinova',hairMasks:0});
  pending.resolve(result);await pending.promise;expect(style.frame()).toBe(false);
  style.choose('endfield');style.frame();style.choose('mmd');style.frame();
  expect(adapter.setStyle.mock.calls).toEqual(['strinova','endfield','mmd'].map(mode=>[model,mode]));style.dispose();
});

it('runs the authored bake only for Endfield, retries after worker failure, and never applies a late choice',async()=>{
  const first=deferred<void>(),retry=deferred<void>();
  const geometry=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise).mockReturnValue(null);
  const adapter={prepareStyle:vi.fn(()=>true),setStyle:vi.fn(()=>true),loadStyleGeometry:geometry};
  const style=createActorStyle({}, {}, {hasBase:true,inputs:[],hybridSlots:{skin:[0]}},adapter,()=>{});
  style.choose('strinova');style.frame();expect(geometry).not.toHaveBeenCalled();
  style.choose('endfield');expect(style.frame()).toBe(false);first.reject(Error('worker unavailable'));await first.promise.catch(()=>{});
  expect(style.snapshot).toMatchObject({phase:'failed',requested:'strinova',mode:'strinova',failedModes:[]});
  style.choose('endfield');style.choose('mmd');style.frame();retry.resolve();await retry.promise;
  expect(style.frame()).toBe(false);expect(style.snapshot.mode).toBe('mmd');
  style.choose('endfield');expect(style.frame()).toBe(true);expect(style.snapshot.mode).toBe('endfield');
  style.dispose();expect(geometry.mock.calls[0][1].aborted).toBe(true);
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

it('reads only an explicitly paired hair UV mask, with raw red and alpha coverage',async()=>{
  const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVR4nGNkYGD4//9ERSPD////GQQYGv4DAEXFCE3ymKBGAAAAAElFTkSuQmCC','base64'));
  const at=(path:string)=>Object.defineProperty(new File([bytes],path.split('/').at(-1)!), 'webkitRelativePath',{value:path});
  const diffuse=at('model/hair.bmp'), mask=at('model/hair.bmp.strand-mask.png');
  const wrong=at('foreign/hair.bmp.strand-mask.png'),generic=at('model/hair_Mask.png');
  const slot={role:'hair',i:3,file:0,width:256,height:256,flipY:true};
  const maps=await loadStrandMasks([slot,{...slot,role:'cloth',i:2}],[diffuse,wrong,mask]);
  expect([...maps.keys()]).toEqual([3]);const texture=maps.get(3);
  expect(texture.flipY).toBe(true);expect([...texture.image.data]).toEqual([0,128,0,16]);texture.dispose();
  expect((await loadStrandMasks([slot],[diffuse,wrong,generic])).size).toBe(0);
  expect((await loadStrandMasks([slot],[diffuse,mask,at('model/hair.bmp.strand-mask.png')])).size).toBe(0);
  expect((await loadStrandMasks([{...slot,width:512}],[diffuse,mask])).size).toBe(0);
});
