// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BufferGeometry, Matrix4, MeshBasicMaterial, PerspectiveCamera, Scene, SkinnedMesh, Vector3, type Ray } from 'three';
import { expect, it, vi } from 'vitest';
import { clearBackpack, useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { createWardrobeModel } from './model';
import { StockingInput } from './StockingInput';
import { readStockingState, useStockings } from './stockingState';
import { WardrobeHudControls, WardrobeScreenControls } from './WardrobeControls';

const harness = vi.hoisted(() => ({ renderer:{} as unknown, fit:'ready', owner:{}, listeners:new Set<()=>void>(), pick:vi.fn() }));
vi.mock('@react-three/fiber', () => ({useThree:()=>harness.renderer, useFrame:vi.fn()}));
vi.mock('./stockingSurface', () => ({pickStockingSurface:harness.pick, stockingFitStatus:()=>harness.fit, readStockingFitOwner:()=>harness.owner,
  subscribeStockingFit:(listener:()=>void)=>{harness.listeners.add(listener);return ()=>harness.listeners.delete(listener);}}));
vi.mock('../hud/PorcelainControls', () => ({HudSheet:()=>null, HudLine:({text}:{text:string})=><span>{text}</span>,
  HudButton:({label,onPress,disabled}:{label:string;onPress():void;disabled?:boolean})=><button disabled={disabled} onClick={onPress}>{label}</button>}));

it.each(['screen','xr'] as const)('routes %s wardrobe → fresh pair → held pull → replacement; ignores another pointer and a stale release', async mode => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  // These custom DOM elements dispatch React handlers in lieu of a renderer.
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const host=document.createElement('div'), root=createRoot(host), canvas=document.createElement('canvas');
  const camera=new PerspectiveCamera(50,1,.02,100);camera.position.z=2;camera.updateMatrixWorld();
  canvas.getBoundingClientRect=()=>new DOMRect(0,0,400,400);
  const sources=[0,1].map(()=>({targetRayMode:'tracked-pointer',targetRaySpace:{}} as XRInputSource));
  const session=Object.assign(new EventTarget(),{visibilityState:'visible',inputSources:sources});
  harness.renderer={scene:new Scene(),camera,gl:{domElement:canvas,xr:{isPresenting:mode==='xr',getReferenceSpace:()=>({}),getCamera:()=>camera,getSession:()=>mode==='xr'?session:null}}};
  harness.fit='ready';
  harness.pick.mockImplementation((_id:string,r:Ray)=>{
    const p=r.at(-r.origin.z/r.direction.z,new Vector3());
    return {side:p.x<.20?'left':'right',u:.5+p.x,v:.5+p.y,point:p,distance:p.distanceTo(r.origin)};
  });
  const file=new File([],'a.pmx'), model=createWardrobeModel(new SkinnedMesh(new BufferGeometry(),new MeshBasicMaterial()),file);
  const actor={assetId:'a',runtimeId:'r'};
  useMmdVrStore.setState({overlayOpen:true,presentation:mode,materialModels:{r:[]},runtimeRef:{getWardrobe:()=>model,setMaterialVisible:vi.fn(),setMaterialOverride:vi.fn()}});
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'r',position:[0,0,0],visible:true}},entries:[{id:'a',kind:'model',file,path:file.name}]});
  function Viewer(){
    const armed=useStockings(s=>s.armed), Wardrobe=mode==='screen'?WardrobeScreenControls:WardrobeHudControls;
    return <><Wardrobe {...actor} onBack={()=>{}}/>{armed&&<StockingInput actor={armed}/>}</>;
  }
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label);
  const click=async(label:string)=>{expect(button(label)?.disabled,label).toBe(false);await act(()=>button(label)!.click());};
  const target=()=>mode==='screen'?canvas:host.querySelector<HTMLElement>('[name="wardrobe:stocking-input"]')!;
  const setCapture=()=>{const el=target();el.setPointerCapture=vi.fn();el.releasePointerCapture=vi.fn();el.hasPointerCapture=()=>true;};
  async function pointer(type:string,id:number,dy:number){
    const e=new PointerEvent(type,{pointerId:id,pointerType:mode==='xr'?'ray':'mouse',button:0,buttons:type==='pointerup'?0:1,isPrimary:true,clientX:id===1?200:285,clientY:200-100*dy,bubbles:true,cancelable:true});
    const x=id===1?0:.25;
    Object.assign(e,{inputSource:sources[id-1],frame:{session,getPose:()=>({emulatedPosition:false,transform:{position:{x,y:dy,z:2},matrix:new Matrix4().makeTranslation(x,dy,2).elements}})}});
    await act(()=>{target().dispatchEvent(e);});
  }
  try {
    await act(()=>root.render(<Viewer/>));await click('黑色长筒袜');expect(button('撕扯模式')!.disabled).toBe(true);
    await click('穿上');await click('撕扯模式');setCapture();
    await pointer('pointerdown',1,0);await pointer('pointerup',1,0);expect(readStockingState('a').tears).toHaveLength(0);
    await pointer('pointerdown',1,0);await pointer('pointerdown',2,0);await pointer('pointerup',2,.09);await pointer('pointercancel',2,.09);
    expect(readStockingState('a').tears).toHaveLength(0);await pointer('pointerup',1,.09);
    expect(readStockingState('a').tears).toEqual([{side:'left',u:expect.closeTo(.5),v:expect.closeTo(.5),du:expect.closeTo(0),dv:expect.any(Number)}]);
    await pointer('pointerdown',1,0);await click('换新一双');expect(useStockings.getState().armed).toBeNull();
    await click('撕扯模式');setCapture();await pointer('pointerup',1,.09);expect(readStockingState('a').tears).toHaveLength(0);
    await pointer('pointerdown',1,0);await act(()=>{harness.owner={};harness.listeners.forEach(f=>f());});
    expect(useStockings.getState().armed).toBeNull();await click('撕扯模式');
    await click('返回衣柜');expect(useStockings.getState().armed).toBeNull();await click('黑色长筒袜');await click('脱下');
    expect(readStockingState('a')).toEqual({worn:false,tears:[]});expect(useBackpack.getState().selected).toBe('a');
  } finally {await act(()=>root.unmount());model.dispose();clearBackpack();useMmdVrStore.setState(useMmdVrStore.getInitialState());vi.restoreAllMocks();vi.unstubAllGlobals();}
});
