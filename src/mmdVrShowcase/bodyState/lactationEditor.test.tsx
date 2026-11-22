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

it('shows each actual drain beside its live level; refill, settings, opening the figure and loading a profile never synthesize a discharge',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  const host=document.createElement('div'),root=createRoot(host);
  const actor={assetId:'a',runtimeId:'r'},saved={...DEFAULT_BODY_PROFILE,lactating:true,left:.15,right:.8};
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}},
    entries:[{id:'a',kind:'model',path:'test.pmx',file:new File([],'test.pmx')}]});
  useBodyState.setState({byAsset:{a:saved}});
  const events:MilkEffectEvent[]=[],stop=subscribeMilkEffects(event=>{events.push(event);return event.kind==='drain'&&event.side==='right';});
  const button=(label:string)=>[...host.querySelectorAll('button')].find(el=>(el.getAttribute('aria-label')??el.textContent)===label);
  const click=async(label:string)=>{const b=button(label);expect(b?.disabled,label).toBe(false);await act(()=>b!.click());};
  const group=(side:string)=>host.querySelector(`[role="group"][aria-label="${side}侧充盈度"]`)!;
  const value=(side:string)=>group(side).querySelector('strong')!.textContent;
  const last=(side:string)=>group(side).querySelector('[aria-live]')!.textContent;
  try{
    await act(()=>root.render(<BodyScreenControls {...actor}/>));
    expect(button('触碰与适配')?.className).toBe(button('乳房观察')?.className);
    await click('泌乳');expect(host.querySelector('input[type=range]')).toBeNull();
    expect([value('左'),value('右')]).toEqual(['15%','80%']);
    await click('乳房观察');await click('返回泌乳');expect(useBodyState.getState().draft).toBeNull();
    await click('泌乳设置');const input=host.querySelector<HTMLInputElement>('input[aria-label="左侧充盈度"]')!;
    const checks=[...host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    expect(checks.map(c=>[c.labels?.[0]?.textContent,c.checked])).toEqual([['左侧裸露',false],['右侧裸露',false]]);
    await act(()=>checks[1].click());expect(useBodyState.getState().draft?.value).toMatchObject({bareLeft:false,bareRight:true});
    await act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'0.1');input.dispatchEvent(new Event('input',{bubbles:true}));});
    await click('返回泌乳');expect(value('左')).toBe('10%');expect(last('左')).toBe('自动回充中');expect(events).toEqual([]);
    await click('排出左侧');expect(button('排出左侧')?.disabled).toBe(true);
    expect(last('左')).toBe('上次仅更新充盈度：10% → 0%');expect(last('右')).toBe('自动回充中');
    await click('排出右侧');expect(last('右')).toBe('上次已排出：80% → 55%');
    await act(()=>advanceLiveBodies(['a'],1.8));expect([value('左'),value('右')]).toEqual(['1%','56%']);
    await click('乳房观察');expect(host.querySelector('.breast-figure dl')?.textContent).toContain('左侧充盈1%右侧充盈56%');
    await click('返回泌乳');await click('胸型');await click('乳房观察');await click('返回胸型');await click('泌乳');
    expect(last('左')).toBe('上次仅更新充盈度：10% → 0%');expect(last('右')).toBe('上次已排出：80% → 55%');
    await click('保存到角色');expect(useBodyState.getState().byAsset.a).toMatchObject({bareLeft:false,bareRight:true});await act(()=>advanceLiveBodies(['a'],18));
    expect(value('左')).toBe('11%');expect(last('右')).toBe('上次已排出：80% → 55%');
    await act(()=>useMmdVrStore.setState({physicsBusy:true}));expect(button('撤销保存')?.disabled).toBe(true);
    expect(events.map(e=>e.kind)).toEqual(['drain','drain']);await act(()=>useMmdVrStore.setState({physicsBusy:false}));
    await click('撤销保存');expect(events.at(-1)).toEqual({kind:'clear',assetId:'a'});
    expect([value('左'),value('右')]).toEqual(['15%','80%']);expect(last('右')).toBe('自动回充中');
    expect(useBodyState.getState().byAsset.a).toEqual(saved);
  }finally{stop();await act(()=>root.unmount());clearBackpack();useBodyState.setState(useBodyState.getInitialState());
    useMmdVrStore.setState({physicsBusy:false});vi.restoreAllMocks();vi.unstubAllGlobals();}
});
