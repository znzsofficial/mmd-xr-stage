import {expect,it,vi} from 'vitest';
// @ts-expect-error Qualification renderer JS, never part of the normal stage entry.
import {createActorMaterialAdapter} from '../../../scripts/webgpu-actor/materialAdapter.js';

const f=vi.hoisted(()=>({prepare:vi.fn(()=>true),attach:vi.fn(()=>true),draw:vi.fn(),enable:vi.fn(),dispose:vi.fn(),bake:vi.fn()}));
vi.mock('@yohawing/three-mmd-loader/webgpu',()=>({createMmdTslPipeline:async()=>({attach:f.attach,prepareRender:f.prepare,createModelLoadOptions:()=>({}),detach:vi.fn()}),disposeMmdTslShadowCaster:vi.fn()}));
vi.mock('../../../scripts/webgpu-actor/endfieldOutline.js',()=>({prepareOutline:f.bake,installOutline:vi.fn()}));
vi.mock('../../../scripts/webgpu-actor/faceKeyShadow.js',()=>({createFaceKeyShadow:()=>({setEnabled:f.enable,prepare:f.draw,dispose:f.dispose,visibility:1})}));
vi.mock('../../../scripts/webgpu-actor/endfieldToon.js',()=>({endfieldColor:()=>({name:'styled'})}));
// Isolate optional-caster lifetime from shader graph construction. The real
// pigment graphs are exercised on WebGPU in stylePigment.proof.js.
vi.mock('../../../scripts/webgpu-actor/mmdStylePigment.js',()=>({mmdStylePigment:()=>({paint:1,resolve:(node:unknown)=>node})}));

function actor(){return {mesh:{material:[{colorNode:{name:'original'},userData:{mmdTslMaterialUniforms:{}}},{userData:{}}]}};}
it('keeps drawing the same actor when its optional face projection fails, and still reports a real pipeline error',async()=>{
  const log=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try {
    const adapter=await createActorMaterialAdapter({xr:{enabled:false}},{}), model=actor(), original=model.mesh.material[0].colorNode;
    adapter.attach(model,undefined,{hybridSlots:{face:[0]}});
    expect(adapter.prepareStyle(model,{face:new Map([[0,{}]]),faceCasterSlots:[1]})).toBe(true);
    adapter.setStyle(model,true);f.draw.mockImplementationOnce(()=>{throw Error('optional target lost');});
    expect(adapter.prepare({})).toBe(true);expect(adapter.prepare({})).toBe(true);expect(f.draw).toHaveBeenCalledTimes(1);
    expect(f.enable).toHaveBeenLastCalledWith(false);expect(model.mesh.material[0].colorNode?.name).toBe('styled');
    expect(adapter.setStyle(model,false)).toBe(true);expect(model.mesh.material[0].colorNode).toBe(original);
    f.prepare.mockImplementationOnce(()=>{throw Error('pipeline failure');});expect(()=>adapter.prepare({})).toThrow('pipeline failure');
    adapter.detach(model);expect(f.dispose).toHaveBeenCalledOnce();
  } finally {log.mockRestore();}
});

it('attaches the original pipeline once even if the optional bake is unsupported',async()=>{
  f.attach.mockClear();f.bake.mockImplementationOnce(()=>{throw Error('unsupported topology');});
  const adapter=await createActorMaterialAdapter({xr:{enabled:false}},{}),model=actor();
  expect(adapter.attach(model,undefined,{hybridSlots:{face:[0]}})).toBe(true);
  expect(adapter.prepareStyle(model,{})).toBe(false);expect(f.attach).toHaveBeenCalledOnce();
  expect(model.mesh.material[0].colorNode?.name).toBe('original');adapter.detach(model);
});
