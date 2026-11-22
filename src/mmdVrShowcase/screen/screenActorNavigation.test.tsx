// @vitest-environment jsdom
import {act,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack';
import {beginBodyPreview,patchBodyPreview,useBodyState} from '../bodyState/store';
import {useMmdVrStore} from '../mmdVrStore';
import {usePelvic} from '../pelvic/store';
import {ScreenStage} from './ScreenStage';

// Stand in for a completed scene pick. The real ray first selects in the
// backpack and then calls the same no-argument callback, even for re-picks.
vi.mock('../components/BackpackPlacement',()=>({BackpackPlacement:({onScreenPick}:{onScreenPick:()=>void})=><>{['a','b'].map(id=><button key={id} onClick={()=>{useBackpack.getState().select(id);onScreenPick();}}>pick {id}</button>)}</>}));
vi.mock('@react-three/fiber',async original=>({...await original(),Canvas:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('../components/MmdVrStage',()=>({MmdVrStageContent:()=>null}));
vi.mock('../play/StoryStations',()=>({StoryStations:()=>null}));
vi.mock('./ScreenCamera',async()=>{const {useLayoutEffect}=await import('react');return {ScreenCamera:({onReady}:{onReady:(v:boolean)=>void})=>{useLayoutEffect(()=>onReady(true),[onReady]);return null;}};});
vi.mock('../music/ScreenMusic',()=>({ScreenMusic:()=>null}));

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
afterEach(async()=>{await act(()=>root.unmount());host.remove();clearBackpack();useMmdVrStore.setState(stage);vi.unstubAllGlobals();});

it('opens the chosen actor directly and lets the bag show every item independently of that selection',async()=>{
  expect(activeSheet()).toBeNull();await click('背包');expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);
  await click('pick b');expect(activeSheet()?.querySelector('h2')?.textContent).toBe('Blue');
  expect(['服装','互动','身体观察','摆位置','动作','摆姿势','身体状态'].filter(x=>button(x)?.disabled!==false)).toEqual([]);
  expect(activeSheet()?.querySelector('.screen-item, .screen-toy-guide')).toBeNull();
  await click('动作');expect(activeSheet()?.textContent).toContain('请先在准备页导入 VMD');
  await click('pick b');await click('摆位置');await click('移动');expect(useBackpack.getState().draft).toBe('b');
  await click('背包');expect(useBackpack.getState().draft).toBeNull();expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);
  await act(()=>activeSheet()!.querySelector<HTMLButtonElement>('.screen-item')!.click());expect(activeSheet()?.querySelector('h2')?.textContent).toBe('Amber');
  await click('全部背包');expect(activeSheet()?.querySelectorAll('.screen-item')).toHaveLength(2);expect(button('身体状态')).toBeUndefined();
});

it('does not replace an explicitly opened bag when placement finishes in the background',async()=>{
  await act(()=>{const b=useBackpack.getState();b.beginPlace('b');b.confirmPlace('b',0,0,0);});
  const command=useBackpack.getState().command!;
  await click('背包');await act(()=>useBackpack.getState().finishCommand(command));
  expect(useBackpack.getState().selected).toBe('b');expect(activeSheet()?.querySelector('h2')?.textContent).toBe('背包');
});

it('can inspect a fresh actor without enabling an attachment or creating a body draft',async()=>{
  await click('pick b');await click('身体观察');
  expect(['乳房','外阴','阴道','子宫'].filter(x=>!button(x))).toEqual([]);
  await click('阴道');expect(usePelvic.getState().byAsset.b).toBeUndefined();
  expect(useBodyState.getState().draft).toBeNull();expect(useBodyState.getState().byAsset.b).toBeUndefined();
  await click('返回角色');await click('互动');await click('插入');
  expect(button('返回互动')).toBeTruthy();await click('返回互动');await click('返回角色');
  expect(button('服装')).toBeTruthy();expect(usePelvic.getState().active).toBeNull();
});

async function startPreview(){
  await click('pick a');await click('身体状态');
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
