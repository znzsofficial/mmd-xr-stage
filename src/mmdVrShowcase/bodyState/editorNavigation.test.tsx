// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack';
import {BodyScreenControls} from './BodyControls';
import {DEFAULT_BODY_PROFILE} from './data';
import {useBodyState} from './store';

it('returns to the fit caller and shares a single reversible preview across settings pages',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const host=document.createElement('div'),root=createRoot(host),saved={...DEFAULT_BODY_PROFILE,fullness:.3};
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'m',visible:true,position:[0,0,0]}},
    entries:[{id:'a',kind:'model',path:'actor.pmx',file:new File([],'actor.pmx')}]});
  useBodyState.setState({byAsset:{a:saved},support:{a:{runtimeId:'m',bones:false,morphs:['Shape'],sides:{left:false,right:false},clothing:'authored-only'}}});
  const click=async(label:string)=>{
    const button=[...host.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===label);
    expect(button?.disabled,label).toBe(false);await act(()=>button!.click());
  };
  const title=()=>host.querySelector('h4')?.textContent;
  try{
    await act(()=>root.render(<BodyScreenControls assetId="a" runtimeId="m"/>));
    expect([...host.querySelectorAll('nav button')].map(b=>b.textContent)).toEqual(['胸型','泌乳']);
    await click('选择模型胸型');await click('返回胸型');expect(title()).toBe('身体设置');
    await click('触碰与适配');await click('模型适配');await click('返回触碰与适配');expect(title()).toBe('触碰与适配');
    await click('返回胸型');
    expect(useBodyState.getState().draft).toBeNull();

    await click('泌乳');await click('开启泌乳');
    expect(host.querySelector('[role=status]')?.textContent).toContain('草稿未保存');
    await click('胸型');await click('触碰与适配');await click('触碰');
    expect(useBodyState.getState().byAsset.a).toEqual(saved);
    expect(useBodyState.getState().draft?.value).toMatchObject({lactating:true,fullness:.3});
    await click('保存到角色');expect(useBodyState.getState().byAsset.a).toMatchObject({lactating:true,fullness:.3});
    expect(host.querySelector('[role=status]')?.textContent).toBe('已保存到角色');
    await click('返回触碰与适配');await click('撤销保存');expect(useBodyState.getState().byAsset.a).toEqual(saved);
    await click('清除本角色设置');expect(useBodyState.getState().byAsset.a).toBeUndefined();
    await click('撤销清除');expect(useBodyState.getState().byAsset.a).toEqual(saved);
    expect(useBodyState.getState().draft).toBeNull();
  }finally{await act(()=>root.unmount());clearBackpack();useBodyState.setState(useBodyState.getInitialState());vi.unstubAllGlobals();}
});

it('keeps preview on section switches and detail back, but discards it on the labelled editor exit',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const host=document.createElement('div'),root=createRoot(host);
  useBackpack.setState({selected:'b',live:{b:{runtimeId:'b1',visible:true,position:[0,0,0]}},
    entries:[{id:'b',kind:'model',path:'actor.pmx',file:new File([],'actor.pmx')}]});
  function ActorTools(){const [open,setOpen]=useState(true);return open?<BodyScreenControls assetId="b" runtimeId="b1" onBack={()=>setOpen(false)}/>:null;}
  const click=async(label:string)=>{const btn=[...host.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===label);expect(btn?.disabled,label).toBe(false);await act(()=>btn!.click());};
  try{
    await act(()=>root.render(<ActorTools/>));await click('触碰与适配');await click('触碰');await click('胀感与触痛');await click('关闭');
    expect(useBodyState.getState().draft).toBeNull();
    await click('返回触碰');await click('返回触碰与适配');await click('返回胸型');
    await click('泌乳');await click('开启泌乳');await click('胸型');await click('触碰与适配');await click('返回胸型');
    expect(useBodyState.getState().draft?.value.lactating).toBe(true);
    await click('不保存并退出');expect(host.children).toHaveLength(0);expect(useBodyState.getState().draft).toBeNull();
    expect(useBodyState.getState().byAsset.b).toBeUndefined();
  }finally{await act(()=>root.unmount());clearBackpack();useBodyState.setState(useBodyState.getInitialState());vi.unstubAllGlobals();}
});
