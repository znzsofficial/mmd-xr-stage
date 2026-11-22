// @vitest-environment jsdom
import {act} from 'react';
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
    const button=[...host.querySelectorAll('button')].find(b=>b.textContent===label);
    expect(button?.disabled,label).toBe(false);await act(()=>button!.click());
  };
  const title=()=>host.querySelector('h4')?.textContent;
  try{
    await act(()=>root.render(<BodyScreenControls assetId="a" runtimeId="m"/>));
    await click('模型适配');await click('返回');expect(title()).toBe('胸型');
    await click('更多设置');await click('模型适配');await click('返回');expect(title()).toBe('更多设置');
    expect(useBodyState.getState().draft).toBeNull();

    await click('泌乳');await click('开启泌乳');await click('分侧设置');await click('排出左侧 25%');
    await click('返回');await click('返回');await click('触碰');
    expect(useBodyState.getState().byAsset.a).toEqual(saved);
    expect(useBodyState.getState().draft?.value).toMatchObject({lactating:true,left:.25,right:.5});
    await click('保存');expect(useBodyState.getState().byAsset.a).toMatchObject({lactating:true,left:.25,right:.5});
    await click('返回');await click('撤销保存');expect(useBodyState.getState().byAsset.a).toEqual(saved);
    expect(useBodyState.getState().draft).toBeNull();
  }finally{await act(()=>root.unmount());clearBackpack();useBodyState.setState(useBodyState.getInitialState());vi.unstubAllGlobals();}
});
