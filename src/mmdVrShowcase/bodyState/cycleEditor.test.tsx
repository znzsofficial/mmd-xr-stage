// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack';
import {BodyHudControls,BodyScreenControls} from './BodyControls';
import {BODY_DAY_SECONDS,DEFAULT_BODY_PROFILE} from './data';
import {advanceLiveBodies,useBodyState} from './store';

// Exercise the actual HUD keys in a DOM host, without claiming renderer coverage.
vi.mock('../../shared/panelTexture',()=>({createPanelTexture:()=>({image:document.createElement('canvas'),dispose:vi.fn()}),roundRectPath:vi.fn()}));

it.each(['screen','XR'] as const)('uses an exact day picker and previews only the selected actor’s timeline on %s',async(surface)=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  if(surface==='XR'){vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});}
  const host=document.createElement('div'),root=createRoot(host),actor={assetId:'a',runtimeId:'r'};
  const original={...DEFAULT_BODY_PROFILE,day:10,daySeconds:12,length:60},other={...DEFAULT_BODY_PROFILE,day:7};
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}},
    entries:['a','b'].map(id=>({id,kind:'model',path:'actor.pmx',file:new File([],'actor.pmx')}))});
  useBodyState.setState({byAsset:{a:original,b:other}});
  const state=useBodyState.getState;
  const button=(label:string)=>surface==='XR'?host.querySelector<HTMLElement>(`mesh[name="hud:${label}"]`):
    [...host.querySelectorAll('button')].find(el=>(el.getAttribute('aria-label')??el.textContent)===label);
  const click=async(label:string)=>{const b=button(label);expect(b,label).toBeTruthy();await act(()=>b!.click());};
  try{
    await act(()=>root.render(surface==='screen'?<BodyScreenControls {...actor}/>:<BodyHudControls {...actor} onBack={()=>{}}/>));
    await click('周期');const calendar=()=>click('选择日期');
    expect(button('子宫动态')).toBeFalsy();expect(button('内膜与分泌物')).toBeFalsy();
    await click('固定日期');await calendar();await click('第 10 天');await calendar();await click('46–60');await click('返回周期');
    expect(state().draft).toBeNull();
    await calendar();await click('46–60');await click('第 60 天');
    expect(state().draft?.value).toMatchObject({day:60,daySeconds:0,locked:true});expect(state().byAsset.a).toBe(original);
    await act(()=>advanceLiveBodies(['a'],BODY_DAY_SECONDS));expect(state().draft?.value.day).toBe(60);
    await click('自动过日');await act(()=>advanceLiveBodies(['a'],BODY_DAY_SECONDS));expect(state().draft?.value.day).toBe(1);
    await click('固定日期');await click('两日内膜对照');await calendar();await click('16–30');await click('第 23 天');
    if(surface==='screen'){
      expect([...host.querySelectorAll('canvas')].map(c=>c.getAttribute('aria-label'))).toEqual([
        expect.stringContaining('角色已存 · 第 10.1 天'),expect.stringContaining('草稿预览 · 第 23 天')]);
    }else expect(host.querySelector('[name="body:lining-sections"]')).toBeTruthy();
    await click('返回周期');await click('高级周期参数');await click('内膜与分泌物');await click('手动设定');
    await click('返回高级周期参数');await click('返回周期');await click('泌乳');expect(state().byAsset.a).toBe(original);
    await click('保存到角色');expect(state().byAsset.a).toMatchObject({day:23,daySeconds:0,locked:true,liningOverride:expect.any(Number)});
    await click('撤销保存');expect(state().byAsset.a).toEqual(original);expect(state().byAsset.b).toBe(other);expect(state().draft).toBeNull();
  }finally{await act(()=>root.unmount());clearBackpack();useBodyState.setState(useBodyState.getInitialState());vi.restoreAllMocks();vi.unstubAllGlobals();}
});
