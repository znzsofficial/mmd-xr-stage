// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {clearBackpack,useBackpack} from '../backpack/store';
import {useConception,type ConceptionEvent} from '../bodyState/reproduction/store';
import {useMmdVrStore} from '../mmdVrStore';
import {readAtlasView,setAtlasView} from '../pelvic/atlas/view';
import type {OrganArtOptions} from '../pelvic/atlas/organArt';
import {usePelvic} from '../pelvic/store';
import {ObservationScreenControls} from './ActorObservation';

const draw=vi.hoisted(()=>vi.fn<(_ctx:CanvasRenderingContext2D,o:OrganArtOptions)=>void>());
vi.mock('../pelvic/atlas/organArt',()=>({createOrganArt:()=>({draw,dispose(){}})}));

it('replays the selected egg on visible picture frames, restores a frozen figure and cannot carry playback to another actor',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  const frames=new Map<number,FrameRequestCallback>();let frameId=0;
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++frameId,cb);return frameId;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
  vi.stubGlobal('Worker',undefined);vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:()=>()=>{}}) as CanvasRenderingContext2D);
  const stage=useMmdVrStore.getState(),language=useLanguageStore.getState();useLanguageStore.setState({language:'en'});
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',playing:false});
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({selected:'a',entries:['a','b'].map(id=>({id,kind:'model',file:new File([],'actor.pmx'),path:'actor.pmx'})),live:{a:live('a'),b:live('b')}});
  const hit:ConceptionEvent={id:5,at:-40000,chance:90,success:true,side:-1,target:'vaginal'},miss:ConceptionEvent={id:6,at:-20000,chance:30,success:false,side:1,target:'fantasyUterine'};
  useConception.setState({byAsset:{a:{chance:0,event:miss,eggs:[{id:1,side:-1,fertilized:true,event:hit},{id:2,side:1,fertilized:false,event:miss}]}}});
  setAtlasView('a',{motion:false});const ledger=useConception.getState(),pelvic=usePelvic.getState();
  const host=document.createElement('div'),root=createRoot(host),key=(name:string)=>[...host.querySelectorAll('button')].find(k=>k.textContent===name)!;
  const open=(id:string)=>act(()=>root.render(<ObservationScreenControls assetId={id} runtimeId={id} initialPart="egg" onBack={()=>{}}/>));
  const press=(name:string)=>act(()=>{expect(key(name)?.disabled,name).toBe(false);key(name).click();});
  const frame=async(now:number)=>{await act(()=>{const queued=[...frames.values()];frames.clear();queued.forEach(cb=>cb(now));});return draw.mock.lastCall![1];};
  const replay='Replay latest result',stop='Stop result replay';
  try{
    await open('a');expect((await frame(0)).encounterSeconds).toBe(12);
    await press(replay);expect(await frame(2000)).toMatchObject({egg:{id:1,event:hit},encounterSeconds:0});
    expect(host.querySelector('canvas')?.getAttribute('aria-label')).toContain('Encounter');
    expect((await frame(7400)).encounterSeconds).toBeCloseTo(5.4);await press('Freeze figure');await frame(7600);
    await press('Side');expect(await frame(18000)).toMatchObject({encounterSeconds:5.4,yaw:Math.PI/2});
    await press('Animate figure');await frame(20000);expect((await frame(25000)).encounterSeconds).toBeCloseTo(10.4);
    await press(stop);expect((await frame(25100)).encounterSeconds).toBe(12);expect(key('Animate figure')).toBeDefined();expect(readAtlasView('a').motion).toBe(false);

    await press('Egg 2');await press(replay);expect(await frame(26000)).toMatchObject({egg:{id:2,event:miss},encounterSeconds:0});
    const held=key(stop);await act(()=>{held.dispatchEvent(new Event('pointerdown',{bubbles:true}));});
    expect((await frame(38000)).encounterSeconds).toBe(12);expect(host.querySelector('canvas')?.getAttribute('aria-label')).toContain('Not fertilized');
    expect(key(replay)).toBe(held);await act(()=>held.click());expect(key(stop)).toBeUndefined();
    await press(replay);await frame(40000);await act(()=>useBackpack.getState().select('b'));await open('b');
    expect(key(replay).disabled).toBe(true);expect((await frame(41000)).egg).toBeUndefined();
    await act(()=>useBackpack.getState().select('a'));await open('a');expect((await frame(42000)).encounterSeconds).toBe(12);expect(key(stop)).toBeUndefined();
    expect(useConception.getState()).toBe(ledger);expect(usePelvic.getState()).toBe(pelvic);expect(useMmdVrStore.getState().playing).toBe(false);
  }finally{await act(()=>root.unmount());clearBackpack();useMmdVrStore.setState(stage);useLanguageStore.setState(language);vi.restoreAllMocks();vi.unstubAllGlobals();}
});
