import {afterEach,expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../../backpack';
import {useMmdVrStore} from '../../mmdVrStore';
import {advancePelvic,assignPelvic,clearPelvicFluid,consumePelvicDose,enablePelvic,nudgePelvic,patchPelvic,publishPelvicSample,publishPelvicSupport,requestPelvicDose,setPelvicCapacity,startPelvic,usePelvic} from '../../pelvic/store';
import {useStagePlay} from '../../play/stagePlay';
import {BODY_DAY_SECONDS} from '../data';
import {createBodyRoom} from '../room';
import {beginBodyPreview,cancelBodyPreview,commitBodyPreview,disableBodyState,fastForwardReproduction,patchBodyPreview,useBodyState} from '../store';
import {reproductiveSample,stageOf} from './game';
import {activeGame,recordInternalDose,useReproduction} from './store';
import {mockGameEntropy} from './entropy.testSupport';

const id='asset-1',other='asset-2',live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
const boot=()=>useBackpack.setState({entries:[id,other].map(id=>({id,kind:'model',path:'same.pmx',file:new File([],'same.pmx')})),selected:id,live:{[id]:live('r'),[other]:live('b')}});
const save=(changes:Parameters<typeof patchBodyPreview>[1],assetId=id)=>{expect(beginBodyPreview(assetId,true)).toBe(true);patchBodyPreview(assetId,changes);commitBodyPreview(assetId);};
const game=()=>activeGame(id)!;
const jump=()=>fastForwardReproduction(id,game());
const stage=useMmdVrStore.getInitialState();
afterEach(()=>{clearBackpack();useStagePlay.getState().reset();useMmdVrStore.setState(stage);vi.restoreAllMocks();});

it('draws a fresh seed for each actor and page, while disabling and restoring an existing actor preserves its actual trial',()=>{
  const entropy=mockGameEntropy(5,2,1);boot();save({day:15,reproduction:true});recordInternalDose(id,1);const first=game();
  expect(first.trial?.implants).toBe(true);save({reproduction:false});save({reproduction:true});expect(game()).toBe(first);
  useBackpack.getState().select(other);save({day:15,reproduction:true},other);expect(activeGame(other)!.seed).not.toBe(first.seed);
  expect(game()).toBe(first);clearBackpack();boot();save({day:15,reproduction:true});recordInternalDose(id,1);
  expect(game().seed).not.toBe(first.seed);expect(stageOf(game())).toBe('unfertilized');expect(entropy).toHaveBeenCalledTimes(3);
});

it('keeps one page-owned game across a draft, disable/enable, runtime replacement and painter-free room clocks',()=>{
  const entropy=mockGameEntropy(5);boot();const support={morphs:[],bones:false,sides:{left:false,right:false},clothing:'authored-only' as const};
  const room=()=>createBodyRoom({getBodySupport:()=>support,setBodyProfile:()=>false},()=>{});
  const first=room();try{
    save({day:23});first.advance(360);expect(useReproduction.getState().byAsset).toEqual({});
    beginBodyPreview(id);patchBodyPreview(id,{reproduction:true,day:15});first.advance(120);expect(game()).toBeUndefined();cancelBodyPreview(id);
    expect(entropy).not.toHaveBeenCalled();
    save({reproduction:true});const opened=game();expect(opened).toMatchObject({day:23,eggs:0,trial:null});first.advance(360);expect(game()).toBe(opened);
    jump();expect(reproductiveSample(game())).toMatchObject({day:29,round:2,stage:'waiting',eggs:0,chance:0});
    jump();const eggs=game();expect(reproductiveSample(eggs)).toMatchObject({day:43,round:2,stage:'ovulated',chance:60,tried:false});
    expect(eggs.eggs).toBeGreaterThan(0);expect(useBodyState.getState().byAsset[id].day).toBe(15);
    save({day:2,locked:false});beginBodyPreview(id);patchBodyPreview(id,{day:26,length:45});expect(game()).toBe(eggs);
    first.advance(BODY_DAY_SECONDS/2);cancelBodyPreview(id);expect(game()).toBe(eggs);
    disableBodyState(id);first.advance(BODY_DAY_SECONDS);expect(game()).toBeUndefined();save({reproduction:true,locked:false});expect(game()).toBe(eggs);
    expect(activeGame(other)).toBeUndefined();first.dispose();useBackpack.getState().publishLive({[id]:live('next')});
    const second=room();try{
      second.advance(BODY_DAY_SECONDS/2-1);expect(game()).toBe(eggs);
      second.advance(1);const next=game();expect(next).toMatchObject({day:44,round:eggs.round,release:eggs.release,side:eggs.side,eggs:eggs.eggs,trial:null});
      expect(reproductiveSample(next)).toMatchObject({stage:'ovulated',chance:48});
      save({day:15});expect(game()).toBe(next); // Saving the tissue release day again cannot reopen the 60% window.
    }finally{second.dispose();}
    clearBackpack();expect(useReproduction.getState().byAsset).toEqual({});expect(entropy).toHaveBeenCalledTimes(1);
  }finally{first.dispose();}
});

it('records a trial only after a current inside delivery with positive retained amount; no replay from fluid, outside, missed or full compartments',()=>{
  mockGameEntropy(5);boot();useMmdVrStore.setState({overlayOpen:true,presentation:'screen',physicsBusy:false,physicsFatal:false});
  enablePelvic(id,true);patchPelvic(id,{clothingClear:true});publishPelvicSupport(id,{kind:'bones',runtimeId:'r',anchorName:'lower body'});
  assignPelvic(id,'standManual','screen');startPelvic(id);const token=usePelvic.getState().active!.token;
  const inside={outletInside:true,outletVisible:false},outside={outletInside:false,outletVisible:true};
  function send(target:'external'|'vaginal'|'fantasyUterine',actual:typeof inside){
    const displayed=target==='external'?outside:inside;
    publishPelvicSample(token,{...displayed,tip:[0,0,0],tail:[0,0,.08],depth:0,lengthM:.09,radiusM:.02,angleDeg:0,aligned:true,atCervix:false});
    expect(requestPelvicDose(id,target)).toBe(true);advancePelvic(token,.015);return consumePelvicDose(token,actual);
  }
  setPelvicCapacity(id,1);expect(send('vaginal',inside)).toBe('internal');expect(game()).toBeUndefined();
  save({reproduction:true});jump();const virgin=game();nudgePelvic(id,1);expect(send('external',outside)).toBe('external');
  expect(send('vaginal',outside)).toBe('none');expect(send('vaginal',inside)).toBe('internal');expect(game()).toBe(virgin); // overflow only
  clearPelvicFluid(id);setPelvicCapacity(id,2);expect(game()).toBe(virgin);
  patchPelvic(id,{container:'fantasyUterine'});expect(send('fantasyUterine',inside)).toBe('internal');const result=game();
  expect(stageOf(result)).toBe('fertilized');expect(send('fantasyUterine',inside)).toBe('internal');expect(game()).toBe(result);
  expect(activeGame(other)).toBeUndefined();save({day:1});expect(game()).toBe(result);
  for(let i=0;i<5;i++)jump();expect(stageOf(game())).toBe('pregnant');
});
