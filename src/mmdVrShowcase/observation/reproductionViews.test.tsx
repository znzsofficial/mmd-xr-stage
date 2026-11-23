// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,Scene} from 'three';
import {useLanguageStore} from '../../languageStore';
import {clearBackpack,useBackpack} from '../backpack';
import {BodyScreenControls} from '../bodyState/BodyControls';
import {activeGame,advanceReproductiveClock,useReproduction} from '../bodyState/reproduction/store';
import {beginBodyPreview,commitBodyPreview,patchBodyPreview,useBodyState} from '../bodyState/store';
import {BODY_DAY_SECONDS,DEFAULT_BODY_PROFILE} from '../bodyState/data';
import {FertilityScreenControls} from '../interaction/FertilityControls';
import {useMmdVrStore} from '../mmdVrStore';
import {PelvicScreenControls} from '../pelvic/Controls';
import {mountPelvicRig} from '../pelvic/rig';
import {enablePelvic,patchPelvic,usePelvic} from '../pelvic/store';
import {makeSilicone} from '../play/workshopModels';
import {siliconeMount,siliconeTilt} from '../play/siliconeProfile';
import {mockGameEntropy} from '../bodyState/reproduction/entropy.testSupport';
import {setAtlasView} from '../pelvic/atlas/view';
import {ObservationScreenControls} from './ActorObservation';
import {LivePelvicScreenView} from './LivePelvicView';

it('opens from the player’s saved day, quotes the dose before it exists and keeps the two monitors identical through a frozen figure, a date edit and fast forwards',async()=>{
  const entropy=mockGameEntropy(5),stage=useMmdVrStore.getState();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);vi.spyOn(document,'hidden','get').mockReturnValue(false);useLanguageStore.setState({language:'zh'});
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',physicsBusy:false,physicsFatal:false});
  const actor={assetId:'asset-1',runtimeId:'first'},live={runtimeId:'first',visible:true,position:[0,0,0] as [number,number,number]};
  useBackpack.setState({selected:actor.assetId,live:{[actor.assetId]:live},entries:[{id:actor.assetId,kind:'model',path:'actor.pmx',file:new File([],'actor.pmx')}]});
  const host=document.createElement('div'),root=createRoot(host),parts=()=>[...host.querySelectorAll<HTMLElement>('.actor-observation,.live-pelvic-view')];
  const editor=()=>act(()=>root.render(<BodyScreenControls {...actor}/>));
  const onInsertion=vi.fn(),onBack=vi.fn(),bench=(fromInsert=false)=>act(()=>root.render(<FertilityScreenControls {...actor} onBack={onBack}
    backLabel={fromInsert?'返回插入':'返回互动'} onInsertion={fromInsert?undefined:onInsertion}/>));
  const show=()=>act(()=>root.render(<><ObservationScreenControls {...actor} initialPart="uterus" onBack={()=>{}}/><LivePelvicScreenView {...actor}/></>));
  const click=(label:string,parent:HTMLElement=host)=>act(()=>{const b=[...parent.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===label);
    expect(b,label).toBeTruthy();expect(b!.disabled).toBe(false);b!.click();});
  const read=()=>{const [a,b]=parts().map(p=>p.querySelector('.uterus-record'));expect(a?.querySelectorAll('dt')).toHaveLength(3);expect(b?.textContent).toBe(a!.textContent);return a!.textContent;};
  const primary=()=>host.querySelector('button[data-primary=true]')?.textContent;
  const scene=new Scene(),model=new Group(),holder=new Group(),piece=new Group(),rod=new Mesh(makeSilicone(),new MeshBasicMaterial());
  rod.name='play:piece:dildo';rod.position.fromArray(siliconeMount);rod.rotation.x=siliconeTilt;piece.add(rod);scene.add(model,holder);holder.add(piece);
  const room=mountPelvicRig({scene,host:holder,getRoot:()=>model,standPiece:()=>piece,standSpray:()=>null});
  const frames=(n:number)=>act(()=>{for(let i=0;i<n;i++)room.advance(1/60);});
  try{
    await show();await click('子宫',parts()[1]);expect(host.querySelector('.uterus-record')).toBeNull();expect(parts().every(p=>p.textContent?.includes('生育模拟未开启'))).toBe(true);
    await editor();await click('周期');expect(host.textContent).not.toContain('生育进程');await click('选择日期');await click('第 10 天');await click('保存到角色');
    await bench();expect(activeGame(actor.assetId)).toBeUndefined();await click('开启生育模拟');expect(primary()).toBe('快进至排卵');
    expect(host.textContent).toContain('组织周期日 10');await click('快进至排卵');expect(host.textContent).toContain('已排卵 · 等待体内释放');
    const window=activeGame(actor.assetId);expect(primary()).toBe('插入操作');await click('插入操作');expect(onInsertion).toHaveBeenCalledOnce();
    await bench(true);await click('插入操作');expect(onBack).toHaveBeenCalledOnce();expect(host.textContent).toContain('返回插入');
    expect(activeGame(actor.assetId)).toBe(window);expect(usePelvic.getState().byAsset[actor.assetId]).toBeUndefined();
    await show();await click('子宫',parts()[1]);expect(read()).toContain('下剂受孕率60%（游戏）');expect(read()).toContain('尚未受精');
    expect(parts()[0].textContent).not.toContain('数据来源');await click('结构标注',parts()[0]);
    expect(parts()[0].textContent).toContain('组织周期日');expect(read()).toContain('尚未受精');await click('结构标注',parts()[0]);
    await act(()=>{setAtlasView(actor.assetId,{motion:false});enablePelvic(actor.assetId,true);patchPelvic(actor.assetId,{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},pitchDeg:0}});});
    await frames(1);await act(()=>root.render(<PelvicScreenControls {...actor}/>));await click('手动支架');await frames(1);await click('保持穿衣继续');await frames(1);
    await click('推进');await frames(45);expect(usePelvic.getState().sample?.outletInside).toBe(true);await click('释放到阴道');await frames(1);
    expect(usePelvic.getState().byAsset[actor.assetId].fluid).toEqual({vaginal:1,fantasyUterine:0});
    await show();await click('子宫',parts()[1]);
    expect(read()).toContain('该次受孕率60%（游戏）');expect(read()).toContain('已受精 · 尚未着床');
    await editor();await click('周期');await click('选择日期');await click('第 2 天');await click('保存到角色');await bench();
    expect(host.textContent).toContain('组织周期日 2');const trial=activeGame(actor.assetId)?.trial;await click('暂停生育模拟');await click('恢复生育模拟');
    expect(activeGame(actor.assetId)?.trial).toBe(trial);expect(entropy).toHaveBeenCalledTimes(1);
    expect(primary()).toBe('推进至 2 细胞');await click('推进至 2 细胞');await click('推进至 4 细胞');await click('推进至 8 细胞');await click('快进至宫腔');await click('查看着床结果');
    await show();await click('子宫',parts()[1]);expect(read()).toContain('生育日 21已着床 · 孕日 7');
  }finally{await act(()=>root.unmount());room.dispose();rod.geometry.dispose();rod.material.dispose();clearBackpack();useMmdVrStore.setState(stage);vi.restoreAllMocks();vi.unstubAllGlobals();}
});

it('starts on the committed day without saving the preview, isolates the game clock and rejects input from the replaced actor',async()=>{
  const entropy=mockGameEntropy(5,2),stage=useMmdVrStore.getState(),body=useBodyState.getState,book=useReproduction.getState;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);vi.spyOn(document,'hidden','get').mockReturnValue(false);useLanguageStore.setState({language:'zh'});
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',physicsBusy:false,physicsFatal:false});
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries:['a','b'].map(id=>({id,kind:'model',path:'same.pmx',file:new File([],'same.pmx')})),selected:'a',live:{a:live('one'),b:live('two')}});
  const saved={...DEFAULT_BODY_PROFILE,day:10,fullness:.15};useBodyState.setState({byAsset:{a:saved}});
  beginBodyPreview('a',true);patchBodyPreview('a',{day:23,fullness:.9,lactating:true});const preview=body().draft!.value;
  const host=document.createElement('div'),root=createRoot(host),show=(id:string,r:string)=>act(()=>root.render(<FertilityScreenControls assetId={id} runtimeId={r} onBack={()=>{}}/>));
  const button=(s:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===s)!;
  const click=(s:string)=>act(()=>{expect(button(s)?.disabled).toBe(false);button(s).click();});
  try{
    await show('a','one');await click('开启生育模拟');expect(body().byAsset.a).toEqual({...saved,reproduction:true});
    expect(body().draft?.value).toEqual({...preview,reproduction:true});expect(activeGame('a')?.day).toBe(10);
    await click('自动');await act(()=>advanceReproductiveClock('a',body().byAsset.a,BODY_DAY_SECONDS));expect(activeGame('a')?.day).toBe(11);
    await click('手动');await act(()=>advanceReproductiveClock('a',body().byAsset.a,BODY_DAY_SECONDS));expect(activeGame('a')?.day).toBe(11);expect(body().byAsset.a.locked).toBe(true);
    await click('快进至排卵');const eggs=activeGame('a');expect(body().draft?.value).toEqual({...preview,reproduction:true});
    await act(()=>commitBodyPreview('a'));expect(activeGame('a')).toBe(eggs);expect(body().byAsset.a).toEqual({...preview,reproduction:true});
    await click('推进一天');expect(host.textContent).toContain('48%（游戏）');await click('推进一天');expect(host.querySelector('[data-primary=true]')?.textContent).toBe('进入下一周期');
    const a=book().byAsset.a,stale=button('进入下一周期');await act(()=>{useBackpack.getState().select('b');stale.click();});expect(book().byAsset.a).toBe(a);
    await show('b','two');expect(book().byAsset.b).toBeUndefined();await click('开启生育模拟');expect(activeGame('b')?.day).toBe(1);
    expect(activeGame('b')?.seed).not.toBe(a.game.seed);expect(a.game.trial).toBeNull();expect(entropy).toHaveBeenCalledTimes(2);
  }finally{await act(()=>root.unmount());clearBackpack();useMmdVrStore.setState(stage);vi.restoreAllMocks();vi.unstubAllGlobals();}
});
