import { expect, it, vi } from 'vitest';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { inspectActorStyle } from '../../../scripts/webgpu-actor/actorStyleSlots.js';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { createActorStyle } from '../../../scripts/webgpu-actor/actorStyle.js';
// @ts-expect-error renderer-only JS lives outside the normal product graph
import { loadActorStyleMaps } from '../../../scripts/webgpu-actor/actorStyleMaps.js';

it('uses authored roles plus their own diffuse family; shared face and body atlases do not authorize detail slots',()=>{
  const material=[['Eye white','face'],['スカート','cloth'],['顔','face'],['body','body'],['Skin','cloth'],
    ['前髪','hair'],['肌','body'],['目影','face'],['革','cloth'],['髪飾り','hair'],['Cloth','cloth','Eye']]
    .map(([name,family,englishName],i)=>({userData:{mmdMaterial:{name,englishName,materialIndex:i,faceCount:3,
      texturePath:`textures/set_${family}_09_D.png`}},map:{image:{width:2,height:2}}}));
  const {hybridSlots,inputs}=inspectActorStyle({mesh:{material}});
  expect(hybridSlots).toEqual({face:[2],skin:[6],hair:[5],cloth:[1],leather:[8],metal:[]});
  expect(inputs.map((s:{i:number})=>s.i)).toEqual([1,2]);
});

function setup() {
  const result={cloth:new Map([[2,{dispose:vi.fn()}]]),face:new Map()};
  result.cloth.set(8,result.cloth.get(2)!);
  let resolve!:(v:typeof result)=>void;
  const promise=new Promise<typeof result>(r=>{resolve=r;});
  const pending={resolve,promise};
  const load=vi.fn((_src:object,_inputs:object[],_signal:AbortSignal)=>promise);
  const adapter={prepareStyle:vi.fn(()=>true),setStyle:vi.fn(()=>true)},notify=vi.fn(), model={};
  const style=createActorStyle(model,{}, {inputs:[{}],hybridSlots:{cloth:[2,8]}},adapter,notify,load);
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

it('discards late resources after actor retirement and keeps a working baseline on missing maps or failure to prepare',async()=>{
  const old=setup(); old.style.choose(true); old.style.dispose();
  expect(old.load.mock.calls[0][2].aborted).toBe(true);
  const before=old.notify.mock.calls.length; old.pending.resolve(old.result); await old.pending.promise; old.style.frame();
  expect(old.result.cloth.get(2)!.dispose).toHaveBeenCalledOnce(); expect(old.notify).toHaveBeenCalledTimes(before);
  expect(old.adapter.prepareStyle).not.toHaveBeenCalled();
  const missing=setup(); missing.style.choose(true); missing.pending.resolve({cloth:new Map(),face:new Map()});
  await missing.pending.promise; missing.style.frame(); expect(missing.style.snapshot).toMatchObject({phase:'unavailable',mode:'mmd'});
  expect(missing.adapter.setStyle).not.toHaveBeenCalled(); missing.style.dispose();
  const bad=setup(); bad.style.choose(true); bad.pending.resolve(bad.result); await bad.pending.promise;
  bad.adapter.prepareStyle.mockImplementation(()=>{throw Error('unsupported graph')}); bad.style.frame();
  expect(bad.style.snapshot).toMatchObject({phase:'failed',mode:'mmd',requested:'mmd'});
  bad.style.dispose(); expect(bad.result.cloth.get(2)!.dispose).toHaveBeenCalledOnce();
});

it('only sends the selected package and resolved diffuse; retiring the actor terminates its decoder',async()=>{
  const fileAt=(path:string)=>Object.defineProperty(new File(['image'],path.split('/').at(-1)!), 'webkitRelativePath',{value:path});
  const a=fileAt('a/model.pmx'), diffuse=fileAt('a/maps/set_cloth_01_D.png');
  const normal=fileAt('a/maps/set_cloth_01_N.png'), other=fileAt('b/maps/set_cloth_01_P.png');
  const files=[a,diffuse,normal,fileAt('b/model.pmx'),other], abort=new AbortController();
  const worker={postMessage:vi.fn(),terminate:vi.fn()}, factory=vi.fn(()=>worker);
  const done=loadActorStyleMaps({file:a,resolver:{resolve:()=>diffuse},companionFiles:files},
    [{i:6,role:'cloth',ref:'maps/set_cloth_01_D.png',width:2,height:2}],abort.signal,factory);
  await Promise.resolve(); expect(worker.postMessage.mock.lastCall?.[0].files.map((v:{file:File})=>v.file)).toEqual([diffuse,normal]);
  abort.abort(); await expect(done).rejects.toMatchObject({name:'AbortError'}); expect(worker.terminate).toHaveBeenCalledOnce();
});
