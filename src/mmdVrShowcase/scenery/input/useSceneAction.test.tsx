// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { ThreeEvent } from '@react-three/fiber';
import { Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import { useBackpack } from '../../backpack/store';
import { useMmdVrStore } from '../../mmdVrStore';
import { useHudWorldInput } from '../../hud/hudWorldInput';
import { useSceneAction } from './useSceneAction';

async function withSwitch(mode: 'xr'|'screen', verify: (input: () => ReturnType<typeof useSceneAction>, action: ReturnType<typeof vi.fn>) => Promise<void>) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const stage=useMmdVrStore.getState(), bag=useBackpack.getState(), panel=useHudWorldInput.getState();
  const root=createRoot(document.createElement('div')), action=vi.fn();
  let current:ReturnType<typeof useSceneAction>;
  function Switch() {
    const input=useSceneAction('weddingCourt',(from,hit)=>from.z>hit.z,action);
    useLayoutEffect(()=>{current=input;});return null;
  }
  try {
    useMmdVrStore.setState({overlayOpen:true,presentation:mode,prefs:{...stage.prefs,scenery:'weddingCourt'}});
    await act(async()=>root.render(<Switch/>));await verify(()=>current,action);
  } finally {
    await act(async()=>root.unmount());useBackpack.setState(bag);useMmdVrStore.setState(stage);useHudWorldInput.setState(panel);vi.unstubAllGlobals();
  }
}
const ray=(pointerId:number,visible=true)=>({pointerId,button:0,delta:0,point:new Vector3(),ray:{origin:new Vector3(0,0,visible?1:-1)},stopPropagation:()=>{}} as ThreeEvent<PointerEvent>);

it('keeps a slow XR press with its first pointer and tests visibility again at release',async()=>{
  await withSwitch('xr',async(input,action)=>{
    const a=ray(4),b=ray(7),events=()=>input().bindings;
    await act(async()=>{events().onPointerEnter(a);events().onPointerEnter(b);});
    events().onPointerDown(a);events().onPointerDown(b);events().onPointerUp(b);
    await act(async()=>events().onPointerLeave(b));expect(input().hovered).toBe(true);expect(action).not.toHaveBeenCalled();
    events().onPointerUp(a);events().onPointerUp(a);expect(action).toHaveBeenCalledOnce();
    events().onPointerDown(a);events().onPointerUp(ray(4,false));events().onPointerUp(a);expect(action).toHaveBeenCalledOnce();
    events().onPointerDown(a);await act(async()=>events().onPointerCancel(a));events().onPointerUp(a);expect(action).toHaveBeenCalledOnce();
  });
});

it('revokes a held XR press even when modal, placement and room changes are batched away',async()=>{
  await withSwitch('xr',async(input,action)=>{
    const a=ray(1),s=useMmdVrStore.getState();
    for(const interrupt of [
      ()=>{useHudWorldInput.setState({blocked:true});useHudWorldInput.setState({blocked:false});},
      ()=>{useBackpack.setState({draft:'new-actor'});useBackpack.setState({draft:null});},
      ()=>{useMmdVrStore.setState({physicsBusy:true});useMmdVrStore.setState({physicsBusy:false});},
      ()=>{useMmdVrStore.setState({prefs:{...s.prefs,scenery:'floor'}});useMmdVrStore.setState({prefs:s.prefs});},
    ]) {
      input().bindings.onPointerDown(a);await act(async()=>interrupt());
      input().bindings.onPointerUp(a);expect(input().enabled).toBe(true);expect(action).not.toHaveBeenCalled();
    }
    input().bindings.onPointerDown(a);input().bindings.onPointerUp(a);expect(action).toHaveBeenCalledOnce();
  });
});

it('accepts screen primary clicks but leaves orbit drags, secondary clicks and occluded targets alone',async()=>{
  await withSwitch('screen',async(input,action)=>{
    const click=(button:number,delta:number,visible=true)=>input().bindings.onClick?.({...ray(1,visible),button,delta});
    await act(async()=>useHudWorldInput.setState({blocked:true})); // XR panel cannot lock a desktop control
    click(2,0);click(0,5);click(0,0,false);expect(action).not.toHaveBeenCalled();
    click(0,4);expect(action).toHaveBeenCalledOnce();
    const oldClick=input().bindings.onClick!;await act(async()=>useBackpack.setState({busy:true}));
    oldClick(ray(1));expect(input().enabled).toBe(false);expect(action).toHaveBeenCalledOnce();
  });
});
