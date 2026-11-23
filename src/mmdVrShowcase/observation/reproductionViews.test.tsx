// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,Scene} from 'three';
import {clearBackpack,useBackpack} from '../backpack';
import {chanceFor,eggsFor,useConception} from '../bodyState/reproduction/store';
import {useBodyState} from '../bodyState/store';
import {useMmdVrStore} from '../mmdVrStore';
import {PelvicScreenControls} from '../pelvic/Controls';
import {mountPelvicRig} from '../pelvic/rig';
import {enablePelvic,patchPelvic,usePelvic} from '../pelvic/store';
import {makeSilicone} from '../play/workshopModels';
import {siliconeMount,siliconeTilt} from '../play/siliconeProfile';
import {ObservationScreenControls} from './ActorObservation';
import {CONCEPTION_REVEAL_MS} from './ConceptionReadouts';

vi.mock('./ObservationDiagram',()=>({ObservationDiagram:({part}:{part:string})=><canvas data-part={part}/>}));

it('sets odds without a rig, resolves consecutive real internal deliveries at 0 and 100, and keeps the read-only encounter with its actor',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  vi.useFakeTimers({toFake:['performance','setTimeout','clearTimeout']});
  const stage=useMmdVrStore.getState();useMmdVrStore.setState({overlayOpen:true,presentation:'screen',physicsBusy:false,physicsFatal:false});
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({selected:'a',live:{a:live('one'),b:live('two')},entries:['a','b'].map(id=>({id,kind:'model',file:new File([],'actor.pmx'),path:'actor.pmx'}))});
  const scene=new Scene(),model=new Group(),holder=new Group(),piece=new Group(),rod=new Mesh(makeSilicone(),new MeshBasicMaterial());
  rod.name='play:piece:dildo';rod.position.fromArray(siliconeMount);rod.rotation.x=siliconeTilt;piece.add(rod);holder.add(piece);scene.add(model,holder);
  const room=mountPelvicRig({scene,host:holder,getRoot:()=>model,standPiece:()=>piece,standSpray:()=>null});
  const host=document.createElement('div'),root=createRoot(host),monitor=()=>host.querySelector<HTMLElement>('.live-pelvic-view')!,observer=()=>host.querySelector<HTMLElement>('.actor-observation')!;
  const show=(id:'a'|'b')=>{const actor={assetId:id,runtimeId:id==='a'?'one':'two'};return act(()=>root.render(<><PelvicScreenControls {...actor}/><ObservationScreenControls {...actor} initialPart="uterus" onBack={()=>{}}/></>));};
  const button=(s:string,parent=host as HTMLElement)=>[...parent.querySelectorAll('button')].find(b=>b.textContent===s)!;
  const click=(s:string,parent=host as HTMLElement)=>act(()=>{const b=button(s,parent);expect(b?.disabled,s).toBe(false);b.click();});
  const slider=()=>monitor().querySelector<HTMLInputElement>('input[aria-label="受孕率（游戏）"]')!;
  const input=(el:HTMLInputElement,n:number)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(n));el.dispatchEvent(new Event('input',{bubbles:true}));};
  const change=(n:number)=>act(()=>input(slider(),n));
  const frames=(n=1)=>act(()=>{for(let i=0;i<n;i++)room.advance(1/60);});
  const age=(ms:number)=>act(()=>{vi.advanceTimersByTime(ms);});
  const result=(parent:HTMLElement)=>parent.querySelector('.uterus-record dd:last-of-type')?.textContent;
  const last=()=>useConception.getState().byAsset.a?.event;
  try{
    await show('a');expect(slider()).toBeNull();expect(monitor().querySelector('canvas[data-part="uterus"]')).toBeTruthy();
    expect(observer().querySelector('canvas[data-part="uterus"]')).toBeTruthy();expect(observer().querySelector('input')).toBeNull();
    await click('卵子',monitor());expect(monitor().querySelector('canvas[data-part="egg"]')).toBeTruthy();expect(eggsFor('a')).toHaveLength(0);
    expect([slider().min,slider().max,slider().step,slider().value]).toEqual(['0','100','5','60']);
    await change(0);expect(chanceFor('a')).toBe(0);expect(last()).toBeUndefined();expect(usePelvic.getState().byAsset.a).toBeUndefined();expect(useBodyState.getState().draft).toBeNull();
    await act(()=>{enablePelvic('a',true);patchPelvic('a',{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},pitchDeg:0}});});
    await frames();await click('手动支架');await frames();await click('保持穿衣继续');await frames();await click('推进');await frames(45);
    expect(usePelvic.getState().sample?.outletInside).toBe(true);await click('释放到阴道');await frames();expect(last()).toBeUndefined();
    for(let i=0;i<3;i++)await click('强制排卵',monitor());expect(button('强制排卵',monitor()).disabled).toBe(true);
    expect(eggsFor('a').every(e=>!e.fertilized&&!e.event)).toBe(true);await click('卵子 1',monitor());
    await click('释放到阴道');expect(last()).toBeUndefined();await frames();
    const missed=last();expect(missed).toMatchObject({chance:0,success:false});expect(result(monitor())).toBe('观察中…');
    await age(CONCEPTION_REVEAL_MS-1);expect(observer().textContent).not.toContain('未受精');await age(1);expect(result(monitor())).toBe('未受精');expect(observer().textContent).toContain('最近结果未受精');

    await click('外阴',monitor());expect(slider()).toBeNull();await click('释放到宫腔');const before=usePelvic.getState();await click('卵子',monitor());await change(100);
    expect(usePelvic.getState()).toBe(before);expect(before.active?.running).toBe(true);expect(last()).toBe(missed);
    await frames();const hit=last();expect(hit).toMatchObject({success:true,chance:100});expect(hit?.id).not.toBe(missed?.id);
    expect(usePelvic.getState().byAsset.a.fluid).toEqual({vaginal:2,fantasyUterine:1});expect(eggsFor('a').map(e=>e.fertilized)).toEqual([true,false,false]);
    await click('卵子 2',monitor());expect(result(monitor())).toBe('待受精');await click('卵子 1',monitor());
    await change(5);expect(last()).toBe(hit);expect(observer().textContent).toContain('受孕率（游戏）5%');expect(observer().textContent).not.toContain('已受精');
    // A new actor owns the editor immediately, even before the next React commit.
    const stale=slider();await act(()=>{useBackpack.getState().select('b');input(stale,95);});expect(chanceFor('a')).toBe(5);
    await show('b');await click('卵子',monitor());expect(slider().value).toBe('60');await age(CONCEPTION_REVEAL_MS);expect(monitor().textContent).toContain('0 / 3');expect(useConception.getState().byAsset.b).toBeUndefined();
    await act(()=>useBackpack.getState().select('a'));await show('a');await click('卵子',monitor());expect(result(monitor())).toBe('已受精');expect(observer().textContent).toContain('最近结果已受精');expect(last()).toBe(hit);
  }finally{await act(()=>root.unmount());room.dispose();rod.geometry.dispose();rod.material.dispose();clearBackpack();useMmdVrStore.setState(stage);vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
