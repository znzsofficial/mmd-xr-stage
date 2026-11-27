// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,Scene,Vector3} from 'three';
import {useLanguageStore} from '../../languageStore';
import {clearBackpack,useBackpack} from '../backpack/store';
import {useMmdVrStore} from '../mmdVrStore';
import {PelvicScreenControls} from './Controls';
import {usePelvicToolLifetime} from './usePelvicControls';
import {advancePelvic,assignPelvic,consumePelvicDose,enablePelvic,interruptPelvic,patchPelvic,publishParkedSample,publishPelvicSample,publishPelvicSupport,startPelvic,usePelvic,type PelvicSample} from './store';
import {mountPelvicRig} from './rig';
import {makeSilicone} from '../play/workshopModels';
import {siliconeMount,siliconeOutlet,siliconeTilt} from '../play/siliconeProfile';
import {pelvicRailLimit,projectDepth} from './path';

const stage=useMmdVrStore.getState(),pelvic=usePelvic.getState;
const renderMonitor=vi.hoisted(()=>vi.fn());
vi.mock('../observation/ObservationDiagram',()=>({ObservationDiagram:({part}:{part:string})=>{renderMonitor();return <canvas data-part={part}/>;}}));
vi.mock('./atlas/AtlasGraphic',()=>({AtlasScreenGraphic:()=>null,AtlasHudGraphic:()=>null}));
const actor={assetId:'a',runtimeId:'r'},initial:PelvicSample={tip:[0,0,.06],tail:[0,0,.18],depth:0,angleDeg:0,aligned:true,
  atCervix:false,outletInside:false,outletVisible:false,radiusM:.024,lengthM:.092};
afterEach(()=>{clearBackpack();useMmdVrStore.setState(stage);vi.restoreAllMocks();vi.unstubAllGlobals();});

it('places the partner on its first press, keeps a running stroke on appearance changes, and previews canal sizing beside its slider',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  const host=document.createElement('div'),root=createRoot(host);
  const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
  const click=async(text:string)=>{expect(button(text)?.disabled).toBe(false);await act(()=>button(text).click());};
  try{
    await act(()=>root.render(<PelvicScreenControls {...actor}/>));await click('半透明搭档');
    await act(()=>publishPelvicSupport('a',{runtimeId:'r',kind:'bones',anchorName:'hips'}));
    expect(pelvic().active?.mode).toBe('standManual');expect(button('半透明搭档').getAttribute('aria-pressed')).toBe('true');
    await act(()=>publishParkedSample(pelvic().active!.token,initial));await click('确认入口露出');
    await act(()=>publishParkedSample(pelvic().active!.token,initial));await click('推进');
    const token=pelvic().active!.token;
    for(const label of ['支架','半透明搭档']){
      await click(label);expect(button(label).getAttribute('aria-pressed')).toBe('true');expect(pelvic().active).toMatchObject({token,running:true});
    }
    await click('调整入口');await click('尺寸');expect(host.querySelector('input[aria-label="阴道长度"]')).toBeTruthy();
    expect(host.querySelector('.pelvic-size-preview [data-part="vagina"]')).toBeTruthy();
    await click('操作');expect(host.querySelector('.live-pelvic-view')?.getAttribute('data-part')).toBe('uterus');
  }finally{await act(()=>root.unmount());}
});

it('sets any rim mode directly without placing a stand or replacing an actor’s recorded entry',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  const host=document.createElement('div'),root=createRoot(host);
  const button=(s:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===s)!;
  const click=(s:string)=>act(()=>button(s).click());
  const choices=()=>host.querySelector('[role=group][aria-label="处女膜"]')!;
  try{
    await act(()=>root.render(<PelvicScreenControls {...actor}/>));await click('外阴');expect(pelvic().byAsset.a).toBeUndefined();
    const keys=Array.from(choices().querySelectorAll('button'));expect(keys.map(k=>k.textContent)).toEqual(['关','弹性','记住首次']);
    expect(keys[0].getAttribute('aria-pressed')).toBe('true');await click('记住首次');
    expect(pelvic().byAsset.a.rimMode).toBe('remember');expect(pelvic().byAsset.a.rimMemory).toBeUndefined();expect(pelvic().active).toBeNull();
    // Revisit a profile carrying a previously measured, actor-local entry.
    await act(()=>usePelvic.setState(s=>({byAsset:{...s.byAsset,a:{...s.byAsset.a,rimMemory:'right'}}})));
    for(const [label,mode] of [['关','off'],['弹性','elastic'],['记住首次','remember']] as const){
      await click(label);expect(pelvic().byAsset.a).toMatchObject({rimMode:mode,rimMemory:'right'});
      expect(Array.from(choices().querySelectorAll('[aria-pressed=true]')).map(b=>b.textContent)).toEqual([label]);
    }
    expect(host.textContent).toContain('首次进入已记录');expect(pelvic().active).toBeNull();
    await click('调整入口');await click('模型');expect(choices()).toBeNull();expect(button('记住首次')).toBeUndefined();
  }finally{await act(()=>root.unmount());}
});

it('exposes the English egg, angle and rim choices on the same actor sheet',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{setItem:vi.fn()});vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useLanguageStore.getState().setLanguage('en');useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  const host=document.createElement('div'),root=createRoot(host),find=(text:string)=>[...host.querySelectorAll('button')].find(k=>k.textContent===text)!;
  const click=(text:string)=>act(()=>find(text).click());
  try{
    await act(()=>root.render(<PelvicScreenControls {...actor}/>));expect(find('Uterus').getAttribute('aria-pressed')).toBe('true');
    await click('Egg');await click('Force ovulation');await click('Side');expect(find('Egg 1').getAttribute('aria-pressed')).toBe('true');expect(find('Side').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('input[aria-label="'+useLanguageStore.getState().t('actorChance')+'"]')).not.toBeNull();
    await click('Vulva');expect(host.querySelector('[role=group][aria-label="Hymen"]')).not.toBeNull();await click('Remember first');
    expect(pelvic().byAsset.a.rimMode).toBe('remember');expect(pelvic().active).toBeNull();
  }finally{await act(()=>root.unmount());useLanguageStore.getState().setLanguage('zh');}
});

it('keeps the manual release gated by the real outlet while viewing a different part or returning from clothing',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  function Parent(){const [page,go]=useState('insert');return page==='insert'?<PelvicScreenControls {...actor} backLabel="返回互动" onBack={()=>go('main')}
    onClothing={()=>go('wardrobe')}/>:<button onClick={()=>go('insert')}>{page} · 返回插入</button>;}
  const host=document.createElement('div'),root=createRoot(host);
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
  const click=async(label:string)=>{expect(button(label)?.disabled).toBe(false);await act(()=>button(label).click());};
  try{
    await act(()=>root.render(<Parent/>));await click('子宫');expect(pelvic().byAsset.a).toBeUndefined();await click('手动支架');
    await act(()=>publishPelvicSupport('a',{runtimeId:'r',kind:'bones',anchorName:'hips',obstruction:'garment'}));
    expect(pelvic().active).toMatchObject({assetId:'a',running:false,mode:'standManual'});expect(button('推进')).toBeUndefined();
    expect(button('保持穿衣继续')).toBeUndefined();await act(()=>publishParkedSample(pelvic().active!.token,initial));
    expect(button('确认入口露出')).toBeUndefined();await click('保持穿衣继续');
    await act(()=>publishParkedSample(pelvic().active!.token,initial));expect(button('目标：宫腔')).toBeUndefined();expect(button('释放到宫腔').disabled).toBe(true);
    await click('推进');const token=pelvic().active!.token;expect(button('释放到宫腔').disabled).toBe(true);
    await act(()=>{publishPelvicSample(token,{...initial,exteriorCovered:true});});
    expect(host.querySelector('[role=status]')?.textContent).toContain('喷口在入口外');expect(button('体外释放').disabled).toBe(true);
    const inside={...initial,tip:[0,0,-.035] as const,outletInside:true,depth:.035,outletVisible:false};
    await act(()=>{publishPelvicSample(token,inside);});expect(pelvic().byAsset.a.container).toBe('vaginal');await click('释放到宫腔');
    expect(pelvic().byAsset.a.fluid.fantasyUterine).toBe(0);await act(()=>{expect(consumePelvicDose(token,inside)).toBe('internal');});
    expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:1});
    expect(host.querySelector('[aria-label="身体特写"]')?.getAttribute('data-part')).toBe('uterus');await click('外阴');
    expect(pelvic().byAsset.a.container).toBe('fantasyUterine');await click('调整服装');await click('wardrobe · 返回插入');
    expect(button('操作').getAttribute('aria-pressed')).toBe('true');
    expect(pelvic().active).toMatchObject({token,running:true});expect(button('释放到宫腔').disabled).toBe(false);
    await click('停止');expect(button('停止').disabled).toBe(true);expect(button('释放到宫腔').disabled).toBe(true);
    expect(pelvic().sample).toBeNull();expect(pelvic().byAsset.a.clothingClear).toBe(false);
  }finally{await act(()=>root.unmount());}
});

it('keeps the XR stand for the clothing detour, retires it on exit, and preserves the deliberate handoff',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);useMmdVrStore.setState({overlayOpen:true,presentation:'xr'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  enablePelvic('a',true);publishPelvicSupport('a',{runtimeId:'r',kind:'bones',anchorName:'hips'});patchPelvic('a',{clothed:true});
  const host=document.createElement('div'),root=createRoot(host);
  function Activity({wardrobe=false}){usePelvicToolLifetime('a','r',true);return wardrobe?<span>Clothing</span>:<span>Insertion</span>;}
  try{
    await act(()=>root.render(<Activity/>));expect(assignPelvic('a','standManual','xr')).toBe(true);expect(startPelvic('a')).toBe(true);
    const mounted=pelvic().active;await act(()=>root.render(<Activity wardrobe/>));expect(pelvic().active).toBe(mounted);
    await act(()=>root.render(null));expect(pelvic().active).toBeNull();
    await act(()=>root.render(<Activity/>));expect(assignPelvic('a','xrManual','xr','left')).toBe(true);expect(startPelvic('a')).toBe(true);
    useBackpack.getState().select(null);await act(()=>root.render(null));expect(pelvic().active).toMatchObject({mode:'xrManual',running:true});
  }finally{await act(()=>root.unmount());}
});

it('places the automatic stand directly and holds its controls and monitor in place across outlet transitions',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  const host=document.createElement('div'),root=createRoot(host);
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
  const click=async(label:string)=>{expect(button(label)?.disabled).toBe(false);await act(()=>button(label).click());};
  const controls=()=>[...host.querySelectorAll('.pelvic-operation button,.pelvic-operation input')];
  try{
    await act(()=>root.render(<PelvicScreenControls {...actor}/>));await click('自动支架');
    await act(()=>publishPelvicSupport('a',{kind:'bones',runtimeId:'r',anchorName:'hips'}));
    expect(pelvic().active).toMatchObject({mode:'standAuto',running:false});
    await act(()=>publishParkedSample(pelvic().active!.token,initial));await click('保持穿衣继续');await act(()=>publishParkedSample(pelvic().active!.token,initial));
    expect(button('阴道').closest('.pelvic-live-plate')).not.toBeNull();expect(button('目标：阴道')).toBeUndefined();
    expect(host.querySelector('.pelvic-depth-reading b')?.textContent).toBe('0.0 cm');
    expect(button('释放到阴道').closest('.pelvic-operation')).not.toBeNull();expect(host.querySelector('.pelvic-stroke-readout')?.textContent).toContain('支架静止');
    expect(button('释放到宫腔').nextElementSibling).toBe(button('体外释放'));expect(button('体外释放').disabled).toBe(true);
    expect(host.querySelector('.pelvic-operation')?.textContent).toContain('体外释放：当前为穿衣模式');
    expect(button('释放到宫腔').disabled).toBe(true);expect(host.querySelector('input[aria-label="每秒往复"]')).toBeTruthy();
    const motor=button('开始往复'),cancel=button('取消释放');expect(motor.nextElementSibling).toBe(cancel);
    expect(button('释放到阴道').nextElementSibling).toBe(button('释放到宫腔'));expect(motor.parentElement).not.toBe(button('释放到阴道').parentElement);
    await click('开始往复');const token=pelvic().active!.token;expect(button('手动支架').disabled).toBe(true);
    expect(button('停止往复')).toBe(motor);expect(motor.dataset.stop).toBe('true');expect(button('开始往复')).toBeUndefined();
    const outside={...initial,exteriorCovered:true},inside={...initial,depth:.02,outletInside:true};
    const sample=async(s:PelvicSample,motion:'outside'|'enter')=>act(()=>{advancePelvic(token,.016);publishPelvicSample(token,s);
      consumePelvicDose(token,{outletInside:s.outletInside,outletVisible:!!s.outletVisible,motion});});
    const readout=()=>host.querySelector('.pelvic-stroke-readout')?.textContent,receipt=()=>host.querySelector('[role=status]')?.textContent;
    await sample(outside,'outside');const nodes=controls(),before=readout();renderMonitor.mockClear();expect(before).toContain('支架往复中');
    await sample(inside,'enter');expect(readout()).toBe(before);expect(host.querySelector('.pelvic-depth-reading b')?.textContent).toBe('2.0 cm');await sample(outside,'outside');expect(renderMonitor).not.toHaveBeenCalled();
    expect(controls().every((n,i)=>n===nodes[i])).toBe(true);expect(readout()).toBe(before);
    await click('释放到宫腔');expect(button('释放到宫腔').disabled).toBe(true);expect(button('释放到阴道').disabled).toBe(true);expect(receipt()).toBe('待释放 · 1 单位');
    expect(pelvic().strokeOrder?.target).toBe('fantasyUterine');expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:0});
    await click('取消释放');expect(pelvic().active).toMatchObject({token,running:true});expect(motor.nextElementSibling).toBe(cancel);
    await sample(inside,'enter');expect(receipt()).toBe('已取消释放');expect(pelvic().byAsset.a.fluid.fantasyUterine).toBe(0);
    await sample(outside,'outside');await click('释放到宫腔');const q=pelvic().strokeOrder;
    for(const tab of ['外阴','卵子','子宫','阴道']){await click(tab);expect(controls().every((node,i)=>node===nodes[i])).toBe(true);}
    expect(pelvic().strokeOrder).toBe(q);expect(pelvic().active).toMatchObject({assetId:'a',token,running:true});
    await sample(inside,'enter');expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:1});expect(pelvic().strokeOrder).toBeNull();
    expect(receipt()).toBe('已释放 · 1 单位');await sample(outside,'outside');expect(receipt()).toBe('已释放 · 1 单位');
    await click('释放到阴道');expect(pelvic().strokeOrder?.target).toBe('vaginal');await click('取消释放');
    expect(controls()).toHaveLength(nodes.length);expect(controls().every((n,i)=>n===nodes[i])).toBe(true);expect(pelvic().byAsset.a.fluid.vaginal).toBe(0);
    await click('停止往复');expect(button('开始往复')).toBe(motor);expect(motor.dataset.stop).toBeUndefined();expect(motor.nextElementSibling).toBe(cancel);
    await act(()=>publishParkedSample(pelvic().active!.token,initial));await click('开始往复');
    // Stop is held through tracking loss and recovery. The same DOM key now
    // offers Start, but completing the old press must not restart the motor.
    await act(()=>{motor.dispatchEvent(new Event('pointerdown',{bubbles:true}));interruptPelvic(pelvic().active!.token);publishParkedSample(pelvic().active!.token,initial);});
    expect(button('开始往复')).toBe(motor);expect(motor.disabled).toBe(false);
    await act(()=>motor.click());expect(pelvic().active?.running).toBe(false);
    await click('对位与测量');expect([...host.querySelectorAll('option')].map(o=>o.text)).toEqual(['入口方向','棒身位置']);
    expect(button('释放到宫腔')).toBeUndefined();await click('精液存量与容量');await click('目标：宫腔');expect(host.textContent).toContain('宫腔 · 1 / 16');
    expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:1});
  }finally{await act(()=>root.unmount());}
});

it('operates the actual paused stand from the recording sheet and requires a physical return before enabling playback',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',playing:false});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  enablePelvic('a',true);patchPelvic('a',{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},pitchDeg:0}});patchPelvic('a',{clothed:true});
  const scene=new Scene(),host3D=new Group(),model=new Group(),piece=new Group(),rod=new Mesh(makeSilicone(),new MeshBasicMaterial());
  rod.name='play:piece:dildo';rod.position.fromArray(siliconeMount);rod.rotation.x=siliconeTilt;piece.add(rod);scene.add(host3D,model);host3D.add(piece);
  const room=mountPelvicRig({scene,host:host3D,getRoot:()=>model,standPiece:()=>piece,standSpray:()=>null});
  const frame=()=>room.advance(1/60);frame();assignPelvic('a','standManual','screen');frame();
  const host=document.createElement('div'),root=createRoot(host);
  const find=(s:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===s)!;
  const click=async(s:string)=>{expect(find(s)?.disabled).toBe(false);await act(()=>find(s).click());};
  const frames=async(n:number)=>act(()=>{for(let i=0;i<n;i++)frame();});
  try{
    await act(()=>root.render(<PelvicScreenControls {...actor}/>));await click('手法录放');await click('录制手法');
    expect(find('保存手法').disabled).toBe(true);await click('推进');await click('推进');await click('推进');await frames(36);
    const at=piece.matrixWorld.clone();expect(pelvic().sample?.outletInside).toBe(true);await click('保存手法');await frames(1);
    expect(find('播放手法').disabled).toBe(true);await click('退出到起点');expect(find('播放手法').disabled).toBe(true);await frames(36);
    await click('循环：关');await click('播放手法');await frames(35);expect(pelvic().sample?.outletInside).toBe(true);
    expect(piece.matrixWorld.elements.every((x,i)=>Math.abs(x-at.elements[i])<1e-6)).toBe(true);
    await click('停止回放');await frames(1);expect(pelvic().byAsset.a.fluid.vaginal).toBe(0);
    await click('清除手法');expect(find('播放手法')).toBeUndefined();expect(pelvic().byAsset.a.technique).toBeUndefined();
  }finally{await act(()=>root.unmount());room.dispose();rod.geometry.dispose();rod.material.dispose();}
});

it('sets calibrated travel and requests one exterior release during the inward stroke from the main sheet',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',playing:false});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  enablePelvic('a',true);patchPelvic('a',{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},offsetM:[0,0,0],lengthM:.09,pitchDeg:0}});patchPelvic('a',{clothingClear:true});
  const scene=new Scene(),model=new Group(),holder=new Group(),piece=new Group(),rod=new Mesh(makeSilicone(),new MeshBasicMaterial());
  model.scale.setScalar(1.25);rod.name='play:piece:dildo';rod.position.fromArray(siliconeMount);rod.rotation.x=siliconeTilt;piece.add(rod);holder.add(piece);scene.add(holder,model);
  const emit=vi.fn();
  const room=mountPelvicRig({scene,host:holder,getRoot:()=>model,standPiece:()=>piece,standSpray:()=>f=>{if(f.action==='start')emit(f.at.clone());}}),frame=()=>room.advance(1/60);
  const host=document.createElement('div'),root=createRoot(host),f={lengthM:.09*1.25},range=pelvicRailLimit(f);
  const click=(label:string)=>act(()=>{const k=Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label);expect(k?.disabled,label).toBe(false);k!.click();});
  const adjust=(label:string,n:number)=>act(()=>{const field=host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;expect(field?.disabled,label).toBe(false);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,String(n));field.dispatchEvent(new Event('input',{bubbles:true}));});
  const measured=()=>projectDepth(f,piece.localToWorld(new Vector3(...siliconeOutlet.position)));
  const maxTravel=async()=>{let peak=0;await act(()=>{for(let i=0;i<150;i++){frame();peak=Math.max(peak,measured());}});return peak;};
  try{
    frame();assignPelvic('a','standAuto','screen');frame();await act(()=>root.render(<PelvicScreenControls {...actor}/>));
    await adjust('最深位置',25);await click('开始往复');expect(await maxTravel()).toBeCloseTo(range*.25,4);
    await adjust('最深位置',85);expect(await maxTravel()).toBeCloseTo(range*.85,2);
    await act(()=>{for(let i=0;i<150&&!pelvic().sample?.outletInside;i++)frame();});expect(pelvic().sample?.outletInside).toBe(true);
    const token=pelvic().active!.token;
    await click('体外释放');expect(host.querySelector('.pelvic-stroke-readout [role=status]')?.textContent).toBe('待体外释放 · 1 单位');
    await click('取消释放');await maxTravel();expect(emit).not.toHaveBeenCalled();expect(pelvic().active).toMatchObject({running:true,token});
    await click('体外释放');await maxTravel();expect(emit).toHaveBeenCalledTimes(1);expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:0});
    expect(host.querySelector('.pelvic-stroke-readout [role=status]')?.textContent).toBe('已体外释放 · 1 单位');await click('停止往复');
    await click('手动支架');await act(()=>frame());await adjust('目标深度',55);await act(()=>{for(let i=0;i<60;i++)frame();});
    expect(measured()).toBeCloseTo(range*.55,5);expect(pelvic().sample?.outletInside).toBe(true);
    expect(host.querySelector('.pelvic-depth-reading b')?.textContent).toBe(`${(measured()*100).toFixed(1)} cm`);
  }finally{await act(()=>root.unmount());room.dispose();rod.geometry.dispose();rod.material.dispose();}
});
