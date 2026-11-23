// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {clearBackpack,useBackpack} from '../backpack';
import {BodyScreenControls} from '../bodyState/BodyControls';
import {recordInternalDose} from '../bodyState/reproduction/store';
import {mockGameEntropy} from '../bodyState/reproduction/entropy.testSupport';
import {setAtlasView} from '../pelvic/atlas/view';
import {ObservationScreenControls} from './ActorObservation';
import {LivePelvicScreenView} from './LivePelvicView';

it('opens from the player’s saved day, quotes the dose before it exists and keeps the two monitors identical through a frozen figure, a date edit and fast forwards',async()=>{
  mockGameEntropy(5);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);useLanguageStore.setState({language:'zh'});
  const actor={assetId:'asset-1',runtimeId:'first'},live={runtimeId:'first',visible:true,position:[0,0,0] as [number,number,number]};
  useBackpack.setState({selected:actor.assetId,live:{[actor.assetId]:live},entries:[{id:actor.assetId,kind:'model',path:'actor.pmx',file:new File([],'actor.pmx')}]});
  const host=document.createElement('div'),root=createRoot(host),parts=()=>[...host.querySelectorAll<HTMLElement>('.actor-observation,.live-pelvic-view')];
  const editor=()=>act(()=>root.render(<BodyScreenControls {...actor}/>));
  const show=()=>act(()=>root.render(<><ObservationScreenControls {...actor} initialPart="uterus" onBack={()=>{}}/><LivePelvicScreenView {...actor}/></>));
  const click=(label:string,parent:HTMLElement=host)=>act(()=>{const b=[...parent.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent)===label);
    expect(b,label).toBeTruthy();expect(b!.disabled).toBe(false);b!.click();});
  const read=()=>{const [a,b]=parts().map(p=>p.querySelector('.uterus-record'));expect(a?.querySelectorAll('dt')).toHaveLength(3);expect(b?.textContent).toBe(a!.textContent);return a!.textContent;};
  try{
    await show();await click('子宫',parts()[1]);expect(host.querySelector('.uterus-record')).toBeNull();expect(parts().every(p=>p.textContent?.includes('生育模拟未开启'))).toBe(true);
    await editor();await click('周期');await click('选择日期');await click('第 10 天');await click('生育进程');await click('开启生育模拟');await click('保存到角色');
    expect(host.textContent).toContain('组织周期日 10 / 生育累计日 10');await click('快进至排卵');expect(host.textContent).toContain('组织周期日 15 / 生育累计日 15');
    await show();await click('子宫',parts()[1]);expect(read()).toContain('下剂受孕率60%（游戏）');expect(read()).toContain('尚未受精');
    expect(parts()[0].textContent).not.toContain('数据来源');await click('结构标注',parts()[0]);
    expect(parts()[0].textContent).toContain('组织周期日');expect(read()).toContain('尚未受精');await click('结构标注',parts()[0]);
    await act(()=>setAtlasView(actor.assetId,{motion:false}));await act(()=>recordInternalDose(actor.assetId,1));
    expect(read()).toContain('该次受孕率60%（游戏）');expect(read()).toContain('已受精 · 尚未着床');
    await editor();await click('周期');await click('选择日期');await click('第 2 天');await click('保存到角色');await click('生育进程');
    expect(host.textContent).toContain('组织周期日 2 / 生育累计日 15');await click('推进一天');await click('推进至 4 细胞');await click('推进至 8 细胞');await click('快进至宫腔');await click('快进，查看是否着床');
    await show();await click('子宫',parts()[1]);expect(read()).toContain('生育日 21已着床 · 孕日 7');
  }finally{await act(()=>root.unmount());clearBackpack();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
