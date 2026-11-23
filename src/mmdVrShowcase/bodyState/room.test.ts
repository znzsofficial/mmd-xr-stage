import { afterEach, expect, it, vi } from 'vitest';
import { clearBackpack, useBackpack } from '../backpack';
import { createBodyRoom } from './room';
import type { BodyProfile } from './data';
import { beginBodyPreview, cancelBodyPreview, commitBodyPreview, debitActorMilk, disableBodyState, inspectBody, patchBodyPreview, setActorMilk, useBodyState, type BodySupport } from './store';

const live=(runtimeId:string,visible=true)=>({runtimeId,visible,position:[0,0,0] as [number,number,number]});
const unsupported:BodySupport={bones:false,sides:{left:false,right:false},morphs:[],clothing:'authored-only'};
afterEach(()=>{clearBackpack();useBodyState.setState({byAsset:{},draft:null,support:{},inspection:null});});

it('retains fractional refill time between held beats without writing across an existing preview',()=>{
  const actor={assetId:'a',runtimeId:'m'};
  useBackpack.setState({entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:live('m')},selected:'a'});
  const room=createBodyRoom({getBodySupport:()=>unsupported,setBodyProfile:()=>false},()=>{});
  try{
    setActorMilk(actor,{lactating:true,refillSeconds:20});const before=useBodyState.getState().byAsset.a;
    for(let i=0;i<10;i++){room.advance(.0625);if(i%2===1)debitActorMilk(actor,['left'],.01);}
    const saved=useBodyState.getState().byAsset.a;expect(saved.left).toBeCloseTo(before.left-.05+.5/20);expect(saved.right).toBeCloseTo(before.right+.5/20);
    beginBodyPreview('a');patchBodyPreview('a',{right:.9});expect(debitActorMilk(actor,['right'],.1)).toBe(null);setActorMilk(actor,{bareRight:true});
    expect(useBodyState.getState().draft?.value.right).toBe(.9);cancelBodyPreview('a');expect(useBodyState.getState().byAsset.a).toBe(saved);
  }finally{room.dispose();}
});

it('can inspect a fresh actor before moving its slider without applying a shape; a replaced editor cannot cancel the new preview',()=>{
  useBackpack.setState({entries:['a','b'].map(id=>({id,kind:'model',file:new File([],'same.pmx'),path:'same.pmx'})),live:{a:live('m'),b:live('n')},selected:'a'});
  const fit=vi.fn((_id:string)=>unsupported),set=vi.fn((_id:string,_profile:BodyProfile|null)=>true),room=createBodyRoom({getBodySupport:fit,setBodyProfile:set},()=>{});
  try{
    const closeOld=inspectBody('a','m');expect(fit.mock.calls).toEqual([['m']]);room.advance(360);
    expect(useBodyState.getState()).toMatchObject({support:{a:{runtimeId:'m'}},byAsset:{},draft:null});
    expect(set.mock.calls.every(([,profile])=>profile===null)).toBe(true);
    const close=inspectBody('a','m');beginBodyPreview('a',true);patchBodyPreview('a',{fullness:.65});closeOld();
    expect(useBodyState.getState().draft?.value.fullness).toBe(.65);close();expect(useBodyState.getState().support).toEqual({});
    expect(set).toHaveBeenLastCalledWith('m',null);expect(useBodyState.getState().byAsset).toEqual({});
  }finally{room.dispose();}
});

it('targets only an explicitly enabled live adult actor; preview, elapsed stores, switching, remounting and forgetting use separate lifetimes',()=>{
  useBackpack.setState({entries:['assetA','assetB','prop'].map((id,i)=>({id,kind:i===2?'object':'model',file:new File(['x'],'same.pmx'),path:'same.pmx'})),
    live:{assetA:live('rt-1'),assetB:live('rt-2'),prop:live('rt-prop')},selected:'assetA'});
  const runtime={getBodySupport:vi.fn(()=>unsupported),setBodyProfile:vi.fn(()=>true)},wake=vi.fn(),room=createBodyRoom(runtime,wake);
  const state=useBodyState.getState;
  try{
    expect(beginBodyPreview('rt-1',true)).toBe(false);expect(beginBodyPreview('prop',true)).toBe(false);
    expect(beginBodyPreview('assetA')).toBe(false);expect(runtime.getBodySupport).not.toHaveBeenCalled();
    expect(beginBodyPreview('assetA',true)).toBe(true);
    expect(state().support.assetA).toMatchObject({runtimeId:'rt-1',morphs:[],bones:false});
    patchBodyPreview('assetA',{fullness:.3,lactating:true,left:.3,right:.7,refillSeconds:20});
    room.advance(1);expect(state().draft?.value).toMatchObject({left:.3,right:.7});
    expect(state().byAsset.assetA).toBeUndefined();commitBodyPreview('assetA');room.advance(1);
    const committed=state().byAsset.assetA;expect(committed.fullness).toBe(.3);
    expect(committed.left).toBeCloseTo(.35);expect(committed.right).toBeCloseTo(.75);
    expect(beginBodyPreview('assetA')).toBe(true);patchBodyPreview('assetA',{fullness:.6,right:.4});room.advance(.5);
    expect(state().byAsset.assetA).toBe(committed);expect(state().draft?.value.fullness).toBe(.6);
    expect(beginBodyPreview('assetB',true)).toBe(false);useBackpack.getState().select('assetB');expect(state().draft).toBeNull();
    expect(beginBodyPreview('assetB',true)).toBe(true);commitBodyPreview('assetA');patchBodyPreview('assetA',{fullness:.9}); // stale callbacks
    expect(state().byAsset.assetA).toBe(committed);expect(state().draft?.value).toMatchObject({fullness:0,lactating:false});
    patchBodyPreview('assetB',{fullness:.1});commitBodyPreview('assetB');
    useBackpack.getState().publishLive({assetB:live('rt-2')});
    expect(runtime.setBodyProfile).toHaveBeenCalledWith('rt-1',null);room.advance(9);
    expect(state().byAsset.assetA).toBe(committed);expect(state().support.assetA).toBeUndefined();
    useBackpack.getState().publishLive({assetB:live('rt-2'),assetA:live('rt-99')});
    expect(runtime.setBodyProfile).toHaveBeenCalledWith('rt-99',committed);
    useBackpack.getState().select('assetA');
    expect(beginBodyPreview('assetA')).toBe(true);patchBodyPreview('assetA',{fullness:.7});cancelBodyPreview('assetA');
    expect(runtime.setBodyProfile).toHaveBeenLastCalledWith('rt-99',committed);expect(wake).toHaveBeenCalled();
    expect(state().byAsset.assetB.fullness).toBe(.1);disableBodyState('assetB');
    expect(state().byAsset.assetB).toBeUndefined();expect(beginBodyPreview('assetB')).toBe(false);
    expect(beginBodyPreview('assetA')).toBe(true);room.dispose();
    expect(state().draft).toBeNull();expect(state().support).toEqual({});expect(state().byAsset.assetA).toBe(committed);
    clearBackpack();expect(state().byAsset).toEqual({});
  }finally{room.dispose();}
});

it('clears a discarded preview even when a cold physics rollback republishes its old profile under the same ID',()=>{
  useBackpack.setState({entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:live('m')},selected:'a'});
  type Mesh={profile:BodyProfile|null};let mesh:Mesh|null={profile:null};const wake=vi.fn();
  const room=createBodyRoom({getBodySupport:()=>mesh?unsupported:null,setBodyProfile:(_,profile)=>{
    if(!mesh||mesh.profile===profile)return false;
    mesh.profile=profile;return true;
  }},wake);
  try{
    beginBodyPreview('a',true);patchBodyPreview('a',{fullness:1});
    const stale={profile:mesh.profile};expect(stale.profile?.fullness).toBe(1);
    mesh=null;cancelBodyPreview('a');expect(useBodyState.getState().support).toEqual({});
    mesh=stale;wake.mockClear();useBackpack.getState().publishLive({a:live('m')});
    expect(mesh.profile).toBeNull();expect(wake).toHaveBeenCalledOnce();
  }finally{room.dispose();}
});
