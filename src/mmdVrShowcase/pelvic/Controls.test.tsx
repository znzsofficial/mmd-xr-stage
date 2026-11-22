// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {PelvicScreenControls} from './Controls';
import {consumePelvicDose,publishParkedSample,publishPelvicSample,publishPelvicSupport,usePelvic,type PelvicSample} from './store';

const stage=useMmdVrStore.getState(),pelvic=usePelvic.getState;
const actor={assetId:'a',runtimeId:'r'},initial:PelvicSample={tip:[0,0,.06],tail:[0,0,.18],depth:0,angleDeg:0,aligned:true,
  atCervix:false,outletInside:false,outletVisible:false,radiusM:.024,lengthM:.092};
afterEach(()=>{clearBackpack();useMmdVrStore.setState(stage);vi.unstubAllGlobals();});

it('keeps the named release on the controls, waits for room evidence and resumes the same rig after either navigation callback',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  function Parent(){const [page,go]=useState('insert');return page==='insert'?<PelvicScreenControls {...actor} backLabel="返回互动" onBack={()=>go('main')}
    onClothing={()=>go('wardrobe')} onObserve={()=>go('observe')}/>:<button onClick={()=>go('insert')}>{page} · 返回插入</button>;}
  const host=document.createElement('div'),root=createRoot(host);
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
  const click=async(label:string)=>{expect(button(label)?.disabled).toBe(false);await act(()=>button(label).click());};
  try{
    await act(()=>root.render(<Parent/>));await click('为此成年角色启用');
    await act(()=>publishPelvicSupport('a',{runtimeId:'r',kind:'bones',anchorName:'hips',obstruction:'garment'}));
    await click('宫腔');expect(button('射入宫腔').disabled).toBe(true);await click('把假阳具放到入口外');
    expect(button('我看到了入口')).toBeUndefined();await click('保持穿衣继续');
    await act(()=>publishParkedSample(pelvic().active!.token,initial));expect(button('射入宫腔').disabled).toBe(true);
    await click('推进');const token=pelvic().active!.token;expect(button('射入宫腔').disabled).toBe(true);
    await act(()=>{publishPelvicSample(token,{...initial,exteriorCovered:true});});
    expect(host.querySelector('[role=status]')?.textContent).toContain('先推进才能射入');expect(button('向外释放').disabled).toBe(true);
    const inside={...initial,tip:[0,0,-.035] as const,outletInside:true,depth:.035,outletVisible:false};
    await act(()=>{publishPelvicSample(token,inside);});await click('射入宫腔');await act(()=>{expect(consumePelvicDose(token,inside)).toBe('internal');});
    expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:1});
    for(const [link,page] of [['身体观察','observe'],['服装','wardrobe']]){
      await click(link);await click(`${page} · 返回插入`);expect(button('操作').getAttribute('aria-pressed')).toBe('true');
      expect(pelvic().active).toMatchObject({token,running:true});expect(button('射入宫腔').disabled).toBe(false);
    }
    await click('停止');expect(button('停止').disabled).toBe(true);expect(button('射入宫腔').disabled).toBe(true);
    expect(pelvic().sample).toBeNull();expect(pelvic().byAsset.a.clothingClear).toBe(false);
  }finally{await act(()=>root.unmount());}
});
