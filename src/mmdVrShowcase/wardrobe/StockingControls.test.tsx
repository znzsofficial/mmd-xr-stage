// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Bone, BufferGeometry, CylinderGeometry, DataTexture, Float32BufferAttribute, Group, Matrix4, MeshBasicMaterial, PerspectiveCamera, Ray, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import { useLanguageStore } from '../../languageStore';
import { clearBackpack, useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { createWardrobeModel } from './model';
import { StockingInput } from './StockingInput';
import { publishGarmentKeys } from './slots';
import { stockingDraws } from './stockingDraws';
import type { inspectStockingFit, StockingPatch } from './stockingFit';
import { armStockingTear, dressStockings, readStockingState, recordStockingTear, useStockings } from './stockingState';
import { mountStockingRoom, readStockingFit, readStockingFitOwner, stockingFitStatus, subscribeStockingFit } from './stockingSurface';
import { WardrobeHudControls, WardrobeScreenControls } from './WardrobeControls';

const harness = vi.hoisted(() => ({ renderer:{} as unknown, inspect:vi.fn<typeof inspectStockingFit>(), pick:vi.fn() }));
vi.mock('@react-three/fiber', () => ({useThree:()=>harness.renderer, useFrame:vi.fn()}));
vi.mock('./stockingFit', () => ({inspectStockingFit:harness.inspect}));
vi.mock('./stockingSurface', async importOriginal => ({...await importOriginal<typeof import('./stockingSurface')>(), pickStockingSurface:harness.pick}));
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
  harness.inspect.mockReset();
  harness.pick.mockImplementation((_id:string,r:Ray)=>{
    const p=r.at(-r.origin.z/r.direction.z,new Vector3());
    return {side:p.x<.20?'left':'right',u:.5+p.x,v:.5+p.y,point:p,distance:p.distanceTo(r.origin)};
  });
  const file=new File([],'a.pmx'), mesh=new SkinnedMesh(new CylinderGeometry(),new MeshBasicMaterial()), model=createWardrobeModel(mesh,file);
  const actor={assetId:'a',runtimeId:'r'};
  let surface={root:new Group(),mesh,renderOrderMeshes:[]};
  const [draw]=stockingDraws(surface);
  const patch=(side:StockingPatch['side']):StockingPatch=>({side,draw,length:1,vertices:[],indices:[],fabricUv:[],sourceUv:[],rim:[]});
  harness.inspect.mockReturnValue({patches:[patch('left'),patch('right')],reason:null,foot:{left:false,right:false}});
  const room=mountStockingRoom(new Scene(),{getModelSurface:()=>surface},()=>false,()=>true);
  const notified=vi.fn(), unsubscribe=subscribeStockingFit(notified);
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
    await act(()=>root.render(<Viewer/>));await click('可撕丝袜');expect(button('撕扯模式')!.disabled).toBe(true);
    expect(host.textContent).toContain('穿上时检查贴合');
    await click('穿上');expect(host.textContent).toContain('正在试穿');expect(button('撕扯模式')!.disabled).toBe(true);
    await act(()=>room.advance(false));expect(host.textContent).toContain('袜身可穿，脚面未贴合。被衣物遮住的袜面不能撕。');
    const firstFit=readStockingFit('r');expect(stockingFitStatus('r')).toBe('ready');expect(readStockingFitOwner('r')).not.toBeNull();
    await act(()=>room.advance(true));expect(readStockingFit('r')).toBe(firstFit);expect(harness.inspect).toHaveBeenCalledTimes(1);expect(notified).toHaveBeenCalledTimes(1);
    harness.inspect.mockReturnValue({patches:[patch('left')],reason:null,foot:{left:false,right:false}});
    await act(()=>{publishGarmentKeys(mesh,['right stocking']);room.advance(false);});
    expect(host.textContent).toContain('仅左腿可穿');expect(host.textContent).toContain('左脚面未贴合');
    await click('撕扯模式');setCapture();
    await pointer('pointerdown',1,0);await pointer('pointerup',1,0);expect(readStockingState('a').tears).toHaveLength(0);
    await pointer('pointerdown',1,0);await pointer('pointerdown',2,0);await pointer('pointerup',2,.09);await pointer('pointercancel',2,.09);
    expect(readStockingState('a').tears).toHaveLength(0);await pointer('pointerup',1,.09);
    expect(readStockingState('a').tears).toEqual([{side:'left',u:expect.closeTo(.5),v:expect.closeTo(.5),du:expect.closeTo(0),dv:expect.any(Number)}]);
    expect(host.textContent).toContain('仅左腿可穿 · 1 处破口');
    await pointer('pointerdown',1,0);await click('换新袜');expect(useStockings.getState().armed).toBeNull();
    await click('撕扯模式');setCapture();await pointer('pointerup',1,.09);expect(readStockingState('a').tears).toHaveLength(0);
    await pointer('pointerdown',1,0);
    harness.inspect.mockReturnValue({patches:[patch('right')],reason:null,foot:{left:false,right:true}});
    await act(()=>{publishGarmentKeys(mesh,['outer']);room.advance(false);});
    expect(readStockingFit('r')).not.toBe(firstFit);expect(host.textContent).toContain('仅右腿可穿');expect(host.textContent).not.toContain('脚面未贴合');
    expect(useStockings.getState().armed).toBeNull();await click('撕扯模式');
    await click('返回衣柜');expect(useStockings.getState().armed).toBeNull();await click('可撕丝袜');await click('脱下');
    expect(readStockingState('a')).toEqual({worn:false,tears:[]});expect(useBackpack.getState().selected).toBe('a');
    await click('返回衣柜');await act(()=>useLanguageStore.setState({language:'en'}));
    await click('Tearable stockings');expect(host.textContent).toContain('Right leg only');
    await act(()=>{surface={...surface};room.advance(false);});
    expect(host.textContent).toContain('Off · Put on to check fit');expect(readStockingFitOwner('r')).toBeNull();
    for (const [reason,english,chinese] of [
      ['leg-rig','Leg bones couldn’t be matched','未识别出可用的腿骨'],
      ['no-surface','No suitable leg surface found','未找到可用的腿部表面'],
      ['leg-coverage','Not enough continuous leg surface','连续的腿面不足以穿上袜身'],
      ['topology-limit','Model mesh exceeds the fitting limit','模型网格超出贴合上限'],
    ] as const) {
      await act(()=>{publishGarmentKeys(mesh,[reason]);room.advance(false);});
      expect(stockingFitStatus('r')).toBe('unknown');
      harness.inspect.mockReturnValue({patches:null,reason});await click('Put on');await act(()=>room.advance(false));
      expect(stockingFitStatus('r')).toBe('unavailable');expect(host.textContent).toContain(english);
      expect(readStockingState('a').worn).toBe(false);expect(button('Put on')!.disabled).toBe(true);expect(button('Tear mode')!.disabled).toBe(true);
      await act(()=>useLanguageStore.setState({language:'zh'}));expect(host.textContent).toContain(chinese);
      await act(()=>useLanguageStore.setState({language:'en'}));
    }
    expect(harness.inspect).toHaveBeenCalledTimes(7);
  } finally {await act(()=>root.unmount());unsubscribe();room.dispose();model.dispose();mesh.geometry.dispose();mesh.material.dispose();clearBackpack();useMmdVrStore.setState(useMmdVrStore.getInitialState());useLanguageStore.setState(useLanguageStore.getInitialState());vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it('retries the real fit after restoring leg skin or replacing a cutout map, preserving tears across rejection', async () => {
  const realFit=await vi.importActual<typeof import('./stockingFit')>('./stockingFit');
  harness.inspect.mockReset().mockImplementation(realFit.inspectStockingFit);
  const skin=new MeshBasicMaterial({transparent:true}), rightSkin=skin.clone(), shoe=new MeshBasicMaterial();
  skin.name='Left Skin';rightSkin.name='Right Skin';shoe.name='Shoes';
  const materials=[skin,rightSkin,shoe], mesh=new SkinnedMesh(new BufferGeometry(),materials), root=new Group();
  const legs=['左','右'].map((prefix,side)=>{
    const x=side===0?.3:-.3;
    const bones=['足','ひざ','足首'].map((name,i)=>{
      const b=new Bone();b.name=prefix+name;b.position.set(x,2-i,0);b.updateMatrixWorld();return b;
    });
    const geometry=new CylinderGeometry(.12,.12,1.8,8,1,true).translate(x,1,0);
    const n=geometry.attributes.position.count, weights=new Float32BufferAttribute(new Float32Array(n*4),4);
    const indices=new Uint16BufferAttribute(new Uint16Array(n*4),4);
    for (let i=0;i<n;i++) {weights.setX(i,1);indices.setX(i,side*3);}
    geometry.setAttribute('skinIndex',indices);geometry.setAttribute('skinWeight',weights);
    return {bones,body:new SkinnedMesh(geometry,materials[side])};
  });
  const skeleton=new Skeleton(legs.flatMap(l=>l.bones)), cover=new SkinnedMesh(legs[0].body.geometry,shoe);
  const bodies=[...legs.map(l=>l.body),cover];
  mesh.userData.mmdMorphSplitBodyMeshes=bodies;
  for (const body of [mesh,...bodies]) {body.bind(skeleton);root.add(body);}
  const surface={mesh,root,renderOrderMeshes:[]}, scene=new Scene();
  const room=mountStockingRoom(scene,{getModelSurface:()=>surface},()=>false,()=>true);
  const actor={assetId:'a',runtimeId:'r'}, file=new File([],'a.pmx');
  const clear=new DataTexture(new Uint8Array([255,255,255,0]),1,1);
  const solid=new DataTexture(new Uint8Array([255,255,255,255]),1,1);
  const stage=useMmdVrStore.getState;
  const replaceSkin=(map:DataTexture)=>{
    skin.map=rightSkin.map=map;
    // A committed wardrobe texture publishes a new list, with the same values.
    stage().setMaterialModels({r:[...stage().materialModels.r]});room.advance(false);
  };
  useMmdVrStore.setState({overlayOpen:true,materialModels:{r:materials.map(m=>({name:m.name,visible:true,opacity:1,roughness:.5,metallic:0,emission:0}))},
    runtimeRef:{setMaterialVisible:(_id,name,visible)=>{materials.find(m=>m.name===name)!.visible=visible;},setMaterialOverride:vi.fn()}});
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}},entries:[{id:'a',kind:'model',file,path:file.name}]});
  const wear=()=>{expect(dressStockings(actor,'wear')).toBe(true);room.advance(false);};
  try {
    stage().setMaterialVisible('r',skin.name,false);stage().setMaterialVisible('r',rightSkin.name,false);
    wear();expect(readStockingFit('r')?.reason).toBe('no-surface');
    expect(readStockingState('a').worn).toBe(false);
    stage().setMaterialVisible('r',skin.name,true);stage().setMaterialVisible('r',rightSkin.name,true);
    room.advance(false);expect(stockingFitStatus('r')).toBe('unknown');
    wear();const fitted=readStockingFit('r');expect(fitted?.patches).toHaveLength(2);
    armStockingTear(actor);const tear={side:'left',u:.5,v:.4,du:.1,dv:.1} as const;
    expect(recordStockingTear(useStockings.getState().armed!,tear)).toBe(true);
    stage().setMaterialVisible('r','Shoes',false);room.advance(false);
    expect(readStockingFit('r')).toBe(fitted);expect(harness.inspect).toHaveBeenCalledTimes(2);
    replaceSkin(clear);expect(readStockingFit('r')?.reason).toBe('leg-coverage');
    expect(readStockingState('a')).toEqual({worn:false,tears:[tear]});
    replaceSkin(solid);expect(readStockingFit('r')).toBeNull();wear();expect(stockingFitStatus('r')).toBe('ready');
    expect(readStockingState('a')).toEqual({worn:true,tears:[tear]});
    room.advance(true);room.advance(false);expect(harness.inspect).toHaveBeenCalledTimes(4);
    stage().setMaterialVisible('r',rightSkin.name,false);room.advance(false);
    expect(readStockingFit('r')?.patches?.map(p=>p.side)).toEqual(['left']);
    expect(readStockingState('a')).toEqual({worn:true,tears:[tear]});
    const probe=(x:number)=>room.pick('r',new Ray(new Vector3(x,1,1),new Vector3(0,0,-1)));
    expect(probe(.32)?.side).toBe('left');expect(probe(-.32)).toBeNull();
    expect(dressStockings(actor,'replace')).toBe(true);room.advance(false);
    expect(readStockingState('a')).toEqual({worn:true,tears:[]});expect(harness.inspect).toHaveBeenCalledTimes(5);
  } finally {
    room.dispose();clearBackpack();useMmdVrStore.setState(useMmdVrStore.getInitialState());
    clear.dispose();solid.dispose();for(const m of materials)m.dispose();skeleton.dispose();mesh.geometry.dispose();
    for(const {body} of legs)body.geometry.dispose();
  }
});
