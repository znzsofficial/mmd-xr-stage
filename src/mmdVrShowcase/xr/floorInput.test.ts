import type { ContextType, ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { startGameFloor } from '../../../scripts/webgpu-actor/stage-host.jsx';
import { useBackpack } from '../backpack/store';
import { useLastPerformanceReport } from '../diagnostics/performanceReport';
import { useMmdVrStore } from '../mmdVrStore';
import { cycleWand, useWandMotor } from '../play/wandMotor';
import { FloorInputContext } from './floorInput';

// Drive the production host's registered callback; replace only the renderer,
// Fiber root and XR binding. The draft, motor and reported intervals are real.
const f=vi.hoisted(()=>({renderer:vi.fn(),render:vi.fn(),advance:vi.fn()}));
vi.mock('../../../scripts/webgpu-actor/floorRenderer.js',()=>({takeFloorRenderer:f.renderer,returnFloorRenderer:vi.fn(),bindFloorSession:vi.fn(),requestFloorDisplay:vi.fn()}));
vi.mock('../../../scripts/webgpu-actor/r187ProjectionOutput.js',()=>({bindR187ProjectionOutput:()=>()=>{}}));
vi.mock('../../../scripts/webgpu-actor/stageActorBackend.js',()=>({createStageActorBackend:async()=>({status:{actors:[]},beginFrame:vi.fn(),dispose:vi.fn()})}));
vi.mock('../../xr/createAppXrStore',()=>({createAppXrStore:()=>({setHand:vi.fn(),setWebXRManager:vi.fn(),destroy:vi.fn()})}));
vi.mock('@react-three/fiber',async original=>({...await original<typeof import('@react-three/fiber')>(),advance:f.advance,extend:vi.fn(),
  createRoot:()=>({configure:vi.fn(),render:f.render}),unmountComponentAtNode:(_:unknown,done:()=>void)=>done()}));

afterEach(()=>{vi.unstubAllGlobals();useWandMotor.setState(useWandMotor.getInitialState());useBackpack.setState(useBackpack.getInitialState());useMmdVrStore.setState(useMmdVrStore.getInitialState());});

it('retires captures before a skipped frame or focus return, keeps a visible stall in the report, and scopes input to one entry',async()=>{
  const makeSession=()=>Object.assign(new EventTarget(),{enabledFeatures:['webgpu'],visibilityState:'visible',frameRate:90,renderState:{},end:vi.fn()});
  const first=makeSession(),second=makeSession();
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false,querySelectorAll:()=>[]}));
  vi.stubGlobal('XRGPUBinding',class {});vi.stubGlobal('location',{search:''});
  vi.stubGlobal('navigator',{gpu:{},xr:{requestSession:vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)}});
  useMmdVrStore.getState().setPrefs({scenery:'floor'});

  type Room=NonNullable<ContextType<typeof FloorInputContext>>;
  let room:Room,loop:(time:number,frame:object)=>void;
  const state={xr:{disconnect:vi.fn()}};
  f.render.mockImplementation((tree:ReactElement<{children:ReactElement[]|ReactElement}>)=>{
    const children=tree.props.children;
    if(Array.isArray(children)) room=(children.find(node=>node.type===FloorInputContext.Provider)!.props as {value:Room}).value;
    else (children.props as {sunRef:{current:object}}).sunRef.current={};
    return {getState:()=>state,setState:vi.fn()};
  });
  f.renderer.mockResolvedValue({xr:{isPresenting:true,setReferenceSpaceType:vi.fn(),getReferenceSpace:()=>({}),getCamera:()=>({cameras:[]})},
    setAnimationLoop:(fn:typeof loop)=>{loop=fn;},init:vi.fn(),backend:{isWebGPUBackend:true},shadowMap:{},info:{render:{},memory:{}}});
  const frame=(session:EventTarget,tracked=true)=>({session,getViewerPose:()=>tracked?{views:[{eye:'left'},{eye:'right'}]}:null});
  const enter=async(session:EventTarget)=>{
    const host=startGameFloor({resume:false,onStatus:()=>{}});
    await vi.waitFor(()=>expect(host.status.phase).toBe('waiting'));
    loop(100,frame(session));await vi.waitFor(()=>expect(useMmdVrStore.getState().phase).toBe('active'));
    return host;
  };
  const host=await enter(first), retired=loop!, old=room!;
  const reasons:string[]=[];old.subscribe(reason=>reasons.push(reason));
  const tick=(time:number,tracked=true)=>retired(time,frame(first,tracked));
  try {
    tick(120);useBackpack.setState({draft:'model'});cycleWand();tick(440);
    expect(reasons).toEqual(['visible-frame-gap']);expect(old.tracked()).toBe(true);
    expect(useBackpack.getState().draft).toBe('model');expect(useWandMotor.getState().speed).toBe(1);
    const draws=f.advance.mock.calls.length;tick(450,false);
    expect(f.advance).toHaveBeenCalledTimes(draws);expect(reasons.at(-1)).toBe('viewer-pose-lost');expect(old.tracked()).toBe(false);
    expect(useBackpack.getState().draft).toBeNull();expect(useWandMotor.getState().speed).toBe(0);
    tick(2000);expect(old.tracked()).toBe(true);tick(2010);
    first.visibilityState='visible-blurred';first.dispatchEvent(new Event('visibilitychange'));
    first.visibilityState='visible';first.dispatchEvent(new Event('visibilitychange'));
    expect(reasons).toEqual(['visible-frame-gap','viewer-pose-lost','visibility-lost']);expect(old.tracked()).toBe(false);
    tick(10000);tick(10010);
  } finally {host.stop();await host.done;}
  expect(useLastPerformanceReport.getState().report).toMatchObject({visibleIntervalMs:360,callbackIntervalMs:{worst:320}});
  expect(old.tracked()).toBe(false);
  const next=await enter(second);
  try {
    useBackpack.setState({draft:'new entry'});const watch=vi.fn();room!.subscribe(watch);
    first.visibilityState='hidden';first.dispatchEvent(new Event('visibilitychange'));retired(12000,frame(first,false));loop!(12000,frame(first,false));
    expect(useBackpack.getState().draft).toBe('new entry');expect(watch).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('blur'));expect(watch).toHaveBeenCalledExactlyOnceWith('visibility-lost');expect(room!.tracked()).toBe(false);
    Object.assign(document,{hidden:true});document.dispatchEvent(new Event('visibilitychange'));
    const before=f.advance.mock.calls.length;loop!(15000,frame(second));
    expect(f.advance).toHaveBeenCalledTimes(before);expect(room!.tracked()).toBe(false);
    Object.assign(document,{hidden:false});document.dispatchEvent(new Event('visibilitychange'));
    expect(room!.tracked()).toBe(false);loop!(15100,frame(second));expect(room!.tracked()).toBe(true);
  } finally {next.stop();await next.done;}
});
