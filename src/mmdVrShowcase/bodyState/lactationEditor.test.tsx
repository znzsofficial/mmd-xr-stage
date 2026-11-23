// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {BodyScreenControls} from './BodyControls';
import {DEFAULT_BODY_PROFILE} from './data';
import {subscribeMilkEffects,type MilkEffectEvent} from './lactation/events';
import {advanceLiveBodies,useBodyState} from './store';

it('sets independent starting levels without pressing: the draft holds them, the saved actor refills, and undo restores the original',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const host=document.createElement('div'),root=createRoot(host),actor={assetId:'a',runtimeId:'r'};
  const saved={...DEFAULT_BODY_PROFILE,left:.15,right:.8,bareRight:true};
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}},
    entries:[{id:'a',kind:'model',path:'test.pmx',file:new File([],'test.pmx')}]});
  useBodyState.setState({byAsset:{a:saved}});
  const events:MilkEffectEvent[]=[],stop=subscribeMilkEffects(e=>{events.push(e);});
  const button=(label:string)=>[...host.querySelectorAll('button')].find(el=>(el.getAttribute('aria-label')??el.textContent)===label);
  const click=async(label:string)=>{const b=button(label);expect(b?.disabled,label).toBe(false);await act(()=>b!.click());};
  const input=(label:string)=>host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const set=async(label:string,value:number)=>{const el=input(label);expect(el.disabled).toBe(false);await act(()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));
  });};
  const state=useBodyState.getState;
  try{
    await act(()=>root.render(<BodyScreenControls {...actor}/>));expect(button('乳房观察')).toBeUndefined();
    await click('泌乳');expect(state().draft).toBeNull();expect(button('关闭泌乳')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('input[type=checkbox]')).toBeNull();expect(button('排出左侧')).toBeUndefined();expect(button('乳房观察')).toBeUndefined();
    await set('左侧起始存量',.05);await set('右侧起始存量',.65);await set('从空回充到满',60);await click('开启泌乳');
    await click('胸型');await act(()=>advanceLiveBodies(['a'],120));await click('泌乳');
    expect(state().byAsset.a).toBe(saved);expect(state().draft?.value).toMatchObject({lactating:true,left:.05,right:.65,refillSeconds:60});
    await click('放弃改动');expect(state().draft).toBeNull();expect(state().byAsset.a).toBe(saved);
    expect(host.querySelector('[role=status]')?.textContent).toContain('已放弃');

    await click('开启泌乳');await set('左侧起始存量',.2);await set('从空回充到满',30);await click('保存到角色');
    expect(state().draft).toBeNull();expect(state().byAsset.a).toMatchObject({left:.2,right:.8,bareRight:true,refillSeconds:30,lactating:true});
    await act(()=>advanceLiveBodies(['a'],9));expect(state().byAsset.a.left).toBeCloseTo(.5);expect(state().byAsset.a.right).toBe(1);
    expect(input('左侧起始存量').getAttribute('aria-valuetext')).toBe('50%');
    await act(()=>useMmdVrStore.setState({physicsBusy:true}));expect(button('撤销保存')?.disabled).toBe(true);
    await act(()=>useMmdVrStore.setState({physicsBusy:false}));await click('撤销保存');
    expect(state().byAsset.a).toEqual(saved);expect(host.querySelector('[role=status]')?.textContent).toContain('已撤销');
    expect(events.filter(e=>e.kind==='drain')).toEqual([]);
  }finally{stop();await act(()=>root.unmount());clearBackpack();useBodyState.setState(useBodyState.getInitialState());
    useMmdVrStore.setState({physicsBusy:false});vi.unstubAllGlobals();}
});
