// @vitest-environment jsdom
import {act,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack/store';
import {beginBodyPreview,patchBodyPreview,useBodyState} from '../bodyState/store';
import {useMmdVrStore} from '../mmdVrStore';
import {enablePelvic,usePelvic} from '../pelvic/store';
import {useConception} from '../bodyState/reproduction/store';
import {ScreenStage} from './ScreenStage';

// Stand in for a completed scene pick. The real ray first selects in the
// backpack and then calls the same no-argument callback, even for re-picks.
vi.mock('../backpack/BackpackPlacement',()=>({BackpackPlacement:({onScreenPick}:{onScreenPick:()=>void})=><>{['a','b'].map(id=><button key={id} onClick={()=>{useBackpack.getState().select(id);onScreenPick();}}>pick {id}</button>)}</>}));
vi.mock('@react-three/fiber',async original=>({...await original(),Canvas:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('../stage/MmdVrStage',()=>({MmdVrStageContent:()=>null}));
vi.mock('../play/StoryStations',()=>({StoryStations:()=>null}));
vi.mock('./ScreenCamera',async()=>{const {useLayoutEffect}=await import('react');return {ScreenCamera:({onReady}:{onReady:(v:boolean)=>void})=>{useLayoutEffect(()=>onReady(true),[onReady]);return null;}};});
vi.mock('../music/ScreenMusic',()=>({ScreenMusic:()=>null}));
vi.mock('../observation/ObservationDiagram',()=>({ObservationDiagram:({part,fertility}:{part:string;fertility?:boolean})=><canvas data-part={part} data-encounter={fertility||undefined}/>}));

HTMLDialogElement.prototype.showModal=function(){this.open=true;};
HTMLDialogElement.prototype.close=function(){this.open=false;};

const stage=useMmdVrStore.getState();
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
const activeSheet=()=>host.querySelector<HTMLElement>('aside:not([hidden])');
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>!b.closest('[hidden]')&&(b.getAttribute('aria-label')??b.textContent)===text)!;
const click=(text:string)=>act(()=>button(text).click());
const escape=()=>act(()=>{host.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true}));});
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const model=(id:string,name:string)=>({id,name,visible:true,rotationY:0,scale:1});
  useMmdVrStore.setState({models:[model('r1','Amber'),model('r2','Blue')]});
  const entries=['a','b'].map(id=>({id,kind:'model' as const,file:new File([],`${id}.pmx`),path:`actors/${id}.pmx`}));
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries,live:{a:live('r1'),b:live('r2')},selected:'a'});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(()=>root.render(<ScreenStage/>));
});
afterEach(async()=>{await act(()=>root.unmount());host.remove();clearBackpack();useMmdVrStore.setState(stage);vi.restoreAllMocks();vi.unstubAllGlobals();});

it('opens the chosen actor directly and lets the bag show every item independently of that selection',async()=>{
  expect(activeSheet()).toBeNull();await click('背包');expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);
  await click('pick b');expect(activeSheet()?.querySelector('h2')?.textContent).toBe('Blue');
  expect(['插入','泌乳','服装','身体观察','摆位置','动作','摆姿势','身体设置'].filter(x=>button(x)?.disabled!==false)).toEqual([]);
  expect(button('互动')).toBeUndefined();expect(button('生育进程')).toBeUndefined();
  expect(activeSheet()?.querySelector('.screen-item, .screen-toy-guide')).toBeNull();
  await click('动作');expect(activeSheet()?.textContent).toContain('请先在准备页导入 VMD');
  await click('pick b');await click('摆位置');await click('移动');expect(useBackpack.getState().draft).toBe('b');
  await click('背包');expect(useBackpack.getState().draft).toBeNull();expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);
  await act(()=>activeSheet()!.querySelector<HTMLButtonElement>('.screen-item')!.click());expect(activeSheet()?.querySelector('h2')?.textContent).toBe('Amber');
  await click('全部背包');expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);expect(button('身体设置')).toBeUndefined();
});

it('does not replace an explicitly opened bag when placement finishes in the background',async()=>{
  await act(()=>{const b=useBackpack.getState();b.beginPlace('b');b.confirmPlace('b',0,0,0);});
  const command=useBackpack.getState().command!;
  await click('背包');await act(()=>useBackpack.getState().finishCommand(command));
  expect(useBackpack.getState().selected).toBe('b');expect(activeSheet()?.querySelector('h2')?.textContent).toBe('背包');
});

it('shows each bound file even with duplicate basenames and unbinds the selected actor’s face',async()=>{
  const motions=['dance','smile'].map(id=>({id,kind:'motion' as const,file:new File([],'take.vmd'),path:`${id}/take.vmd`}));
  await act(()=>useBackpack.setState(s=>({entries:[...s.entries,...motions],bindings:{b:{body:motions[0].file,face:motions[1].file}}})));
  await click('pick b');await click('动作');
  const selects=activeSheet()!.querySelectorAll('select');expect([...selects].map(s=>s.selectedOptions[0].textContent)).toEqual(motions.map(m=>m.path));
  await click('解除表情动作');expect(useBackpack.getState().command).toMatchObject({id:'b',runtimeId:'r2',kind:'face',file:null});
});

it('can inspect a fresh actor without enabling an attachment or creating a body draft',async()=>{
  await click('pick b');await click('身体观察');
  expect(['乳房','外阴','阴道','子宫'].filter(x=>!button(x))).toEqual([]);
  await click('子宫');expect(activeSheet()?.querySelector('[data-part="uterus"]:not([data-encounter])')).toBeTruthy();
  expect(activeSheet()?.querySelector('.uterus-record')?.textContent).toContain('受孕率（游戏）60%');expect(useConception.getState().byAsset.b).toBeUndefined();
  await click('阴道');expect(usePelvic.getState().byAsset.b).toBeUndefined();
  expect(useBodyState.getState().draft).toBeNull();expect(useBodyState.getState().byAsset.b).toBeUndefined();
  await click('返回角色');await click('插入');await click('返回角色');
  expect(button('服装')).toBeTruthy();expect(usePelvic.getState().active).toBeNull();
});

it('opens insertion on the whole uterus, keeps a chosen view across clothing and leaves the release target alone',async()=>{
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  await click('pick b');await act(()=>{useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});expect(enablePelvic('b',true)).toBe(true);});
  const profile=usePelvic.getState().byAsset.b;
  expect([...host.querySelectorAll('.screen-actor-activities button')].map(k=>k.textContent)).toEqual(['插入','泌乳']);
  await click('插入');expect(button('子宫').getAttribute('aria-pressed')).toBe('true');expect(activeSheet()?.querySelector('canvas[data-part="uterus"]:not([data-encounter])')).toBeTruthy();
  await click('外阴');await click('斜面');await click('调整服装');await click('返回插入');
  expect(button('外阴').getAttribute('aria-pressed')).toBe('true');expect(button('斜面').getAttribute('aria-pressed')).toBe('true');
  expect(activeSheet()?.querySelector('[data-encounter]')).toBeNull();expect(activeSheet()?.querySelector('input[aria-label="受孕率（游戏）"]')).toBeNull();
  await click('卵子');expect(activeSheet()?.querySelector('input[aria-label="受孕率（游戏）"]')).toBeTruthy();
  await click('返回角色');expect(button('身体设置')).toBeDefined();
  expect(usePelvic.getState().byAsset.b).toBe(profile);expect(profile.container).toBe('vaginal');
  expect(useBodyState.getState().draft).toBeNull();expect(useConception.getState().byAsset.b).toBeUndefined();
});

async function startPreview(){
  await click('pick a');await click('身体设置');
  await act(()=>{expect(beginBodyPreview('a',true)).toBe(true);patchBodyPreview('a',{fullness:.7});});
  await click('触碰与适配');
}
it('collapses to the stage, retains the same draft and page through the bag, and restores focus on both paths',async()=>{
  await startPreview();const inspection=useBodyState.getState().inspection;
  await escape();expect(activeSheet()).toBeNull();expect(host.querySelector('.body-editor')).toBeNull();
  expect(document.activeElement).toBe(button('预览中 · 继续编辑'));expect(useBodyState.getState().inspection).toBe(inspection);
  await click('背包');expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);
  await click('预览中 · 继续编辑');expect(activeSheet()?.querySelector('.body-editor')?.getAttribute('data-page')).toBe('more');
  expect(document.activeElement).toBe(activeSheet()?.querySelector('.body-page h4'));
  await click('收起');await click('pick a');expect(activeSheet()?.querySelector('.body-editor')?.getAttribute('data-page')).toBe('more');
  expect(useBodyState.getState().draft?.value.fullness).toBe(.7);expect(useBodyState.getState().inspection).toBe(inspection);
  await click('收起');await click('pick b');expect(activeSheet()?.querySelector('h2')?.textContent).toBe('Blue');
  expect(useBodyState.getState().draft).toBeNull();expect(useBodyState.getState().inspection).toBeNull();
});

it.each(['runtime','room'] as const)('releases a hidden preview on %s replacement',async(change)=>{
  await startPreview();await click('收起');
  await act(()=>{if(change==='room')useMmdVrStore.getState().setPrefs({scenery:'pool'});
    else{const bag=useBackpack.getState();bag.publishLive({...bag.live,a:{...bag.live.a,runtimeId:'new'}});}});
  expect(host.querySelector('aside[hidden]')).toBeNull();expect(button('预览中 · 继续编辑')).toBeUndefined();
  expect(useBodyState.getState().draft).toBeNull();expect(useBodyState.getState().inspection).toBeNull();
});
