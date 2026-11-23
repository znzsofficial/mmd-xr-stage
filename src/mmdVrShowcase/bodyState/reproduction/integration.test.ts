import {afterEach,expect,it,vi} from 'vitest';
import {clearBackpack,prepareBackpackEntry,syncBackpackFiles,useBackpack} from '../../backpack';
import {useMmdVrStore} from '../../mmdVrStore';
import {advancePelvic,assignPelvic,cancelStrokeDose,clearPelvicFluid,consumePelvicDose,enablePelvic,patchPelvic,publishPelvicSample,publishPelvicSupport,
  requestPelvicDose,requestStrokeDose,setPelvicCapacity,startPelvic,usePelvic,type PelvicDoseTarget,type PelvicMode} from '../../pelvic/store';
import {useStagePlay} from '../../play/stagePlay';
import {chanceFor,eggsFor,forceOvulation,recordInternalDose,setConceptionChance,useConception} from './store';

const bag=useBackpack.getState,ledger=useConception.getState,event=(id:string)=>ledger().byAsset[id]?.event;
const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
const inside={outletInside:true,outletVisible:false},outside={outletInside:false,outletVisible:true},hidden={outletInside:false,outletVisible:false};
function setup(source:'xr'|'screen'='screen'){
  const files=[new File([],'same.pmx'),new File([],'same.pmx'),new File([],'stage.glb')];
  syncBackpackFiles(files);
  const [a,b,object]=files.map(f=>bag().entries.find(e=>e.file===f)!.id);
  bag().publishLive({[a]:live('r1'),[b]:live('r2'),[object]:live('object')});bag().select(a);
  useMmdVrStore.setState({overlayOpen:true,presentation:source,physicsBusy:false,physicsFatal:false});
  return {a,b,object,files};
}
function mount(id:string,mode:PelvicMode='standManual'){
  bag().select(id);expect(enablePelvic(id,true)).toBe(true);expect(patchPelvic(id,{clothingClear:true})).toBe(true);
  publishPelvicSupport(id,{kind:'bones',runtimeId:bag().live[id].runtimeId,anchorName:'lower body'});
  expect(assignPelvic(id,mode,mode==='xrManual'?'xr':'screen')).toBe(true);
  expect(startPelvic(id)).toBe(true);return usePelvic.getState().active!.token;
}
function queue(id:string,token:number,target:PelvicDoseTarget){
  const displayed=target==='external'?outside:inside;
  expect(publishPelvicSample(token,{...displayed,tip:[0,0,0],tail:[0,0,.08],depth:displayed.outletInside?.02:0,lengthM:.09,radiusM:.02,angleDeg:0,aligned:true,atCervix:false})).toBe(true);
  expect(requestPelvicDose(id,target,token)).toBe(true);
}
function consume(token:number,outlet=inside){advancePelvic(token,.015);return consumePelvicDose(token,outlet);}
afterEach(()=>{clearBackpack();useStagePlay.getState().reset();useMmdVrStore.setState(useMmdVrStore.getInitialState());vi.restoreAllMocks();});

it('edits only the selected visible model instance; no configuration, bad amount or non-model can create an event',()=>{
  const {a,b,object}=setup();const draw=vi.spyOn(Math,'random');
  expect(eggsFor(a)).toEqual([]);expect(forceOvulation(a,'r2')).toBe(false);expect(forceOvulation(b,'r2')).toBe(false);
  expect(chanceFor(a)).toBe(60);expect(setConceptionChance(a,'r2',70)).toBe(false);
  expect(setConceptionChance(b,'r2',70)).toBe(false);expect(setConceptionChance(a,'r1',NaN)).toBe(false);
  bag().select(object);expect(setConceptionChance(object,'object',70)).toBe(false);expect(forceOvulation(object,'object')).toBe(false);bag().select(a);
  useBackpack.setState({live:{...bag().live,[a]:{...live('r1'),visible:false}}});expect(setConceptionChance(a,'r1',70)).toBe(false);
  bag().publishLive({...bag().live,[a]:live('r1')});bag().beginPlace(a);expect(setConceptionChance(a,'r1',70)).toBe(false);bag().cancelPlace();
  for(const amount of [0,-1,Infinity,NaN])recordInternalDose(a,amount);
  expect(ledger().byAsset).toEqual({});
  for(const [input,expected] of [[-5,0],[155,100],[37.5,37.5]]){
    expect(setConceptionChance(a,'r1',input)).toBe(true);expect(chanceFor(a)).toBe(expected);expect(event(a)).toBeUndefined();
  }
  expect(draw).not.toHaveBeenCalled();expect(chanceFor(b)).toBe(60);
});

it('uses delivery-time odds and the retained compartment; the same command cannot roll on another frame',()=>{
  const {a}=setup(),t=mount(a);const draw=vi.spyOn(Math,'random').mockReturnValueOnce(.60).mockReturnValueOnce(.599);
  const now=vi.spyOn(performance,'now').mockReturnValue(1234);
  for(let i=0;i<3;i++)expect(forceOvulation(a,'r1')).toBe(true);
  queue(a,t,'vaginal');expect(event(a)).toBeUndefined();expect(consume(t)).toBe('internal');
  const first=event(a)!;expect(first).toMatchObject({at:1234,chance:60,success:false,target:'vaginal'});
  expect(eggsFor(a)[0]).toMatchObject({id:1,fertilized:false,event:first});expect(eggsFor(a)[1].event).toBeUndefined();
  expect(consumePelvicDose(t,inside)).toBe('none');expect(consume(t)).toBe('none');expect(event(a)).toBe(first);

  queue(a,t,'vaginal');expect(consume(t)).toBe('internal');const second=event(a)!;
  expect(second).toMatchObject({at:1234,chance:60,success:true,target:'vaginal'});expect(second.id).not.toBe(first.id);
  expect(eggsFor(a)[0]).toMatchObject({id:1,fertilized:true,event:second});expect(second.side).toBe(first.side);
  setConceptionChance(a,'r1',0);queue(a,t,'fantasyUterine');setConceptionChance(a,'r1',100);
  expect(event(a)).toBe(second);now.mockReturnValue(1300);expect(consume(t)).toBe('internal');const third=event(a)!;
  expect(third).toMatchObject({at:1300,chance:100,success:true,target:'fantasyUterine'});expect(third.id).not.toBe(second.id);
  patchPelvic(a,{container:'vaginal'});setConceptionChance(a,'r1',0);
  expect(chanceFor(a)).toBe(0);expect(event(a)).toBe(third);expect(event(a)?.target).toBe('fantasyUterine');
  queue(a,t,'vaginal');expect(consume(t)).toBe('internal');expect(event(a)).toMatchObject({chance:0,success:false,target:'vaginal'});
  expect(usePelvic.getState().byAsset[a].fluid).toEqual({vaginal:3,fantasyUterine:1});expect(draw).toHaveBeenCalledTimes(2);
});

it('requires positive retention: missed, exterior, cancelled and wholly overflowing doses do not roll',()=>{
  const {a}=setup(),t=mount(a);const draw=vi.spyOn(Math,'random').mockReturnValue(.5);
  forceOvulation(a,'r1');forceOvulation(a,'r1');forceOvulation(a,'r1');
  for(const [target,outlet,route] of [['vaginal',outside,'none'],['vaginal',hidden,'none'],['external',inside,'none'],['external',outside,'external']] as const){
    queue(a,t,target);expect(consume(t,outlet)).toBe(route);expect(consume(t)).toBe('none');
  }
  const auto=mount(a,'standAuto');expect(requestStrokeDose(a,auto,'vaginal')).toBe(true);
  expect(cancelStrokeDose(usePelvic.getState().strokeOrder!.id)).toBe(true);advancePelvic(auto,.015);
  expect(consumePelvicDose(auto,{...inside,motion:'enter'})).toBe('none');expect(event(a)).toBeUndefined();expect(draw).not.toHaveBeenCalled();

  const manual=mount(a);setPelvicCapacity(a,1.25);
  for(let i=0;i<2;i++){queue(a,manual,'vaginal');expect(consume(manual)).toBe('internal');}
  const partial=event(a);expect(partial).toBeDefined();expect(draw).toHaveBeenCalledTimes(2);
  queue(a,manual,'vaginal');expect(consume(manual)).toBe('internal');
  expect(usePelvic.getState().byAsset[a]).toMatchObject({fluid:{vaginal:1.25},overflow:1.75});
  clearPelvicFluid(a);expect(event(a)).toBe(partial);expect(draw).toHaveBeenCalledTimes(2);
});

it('keeps actors separate through selection, room change and re-entry; deleting a file removes only its account',()=>{
  const {a,b,files}=setup(),first=mount(a);setConceptionChance(a,'r1',0);
  forceOvulation(a,'r1');
  queue(a,first,'vaginal');expect(consume(first)).toBe('internal');const savedA=event(a)!;
  queue(a,first,'vaginal');const second=mount(b);expect(consume(first)).toBe('none');expect(event(b)).toBeUndefined();
  forceOvulation(b,'r2');setConceptionChance(b,'r2',100);queue(b,second,'fantasyUterine');expect(consume(second)).toBe('internal');const savedB=event(b)!;
  expect(savedB).toMatchObject({chance:100,success:true});expect(event(a)).toBe(savedA);
  queue(b,second,'vaginal');useMmdVrStore.getState().setPrefs({scenery:'clinic'});expect(consume(second)).toBe('none');
  prepareBackpackEntry(true);bag().publishLive({[a]:live('new'),[b]:live('new2')});bag().select(a);
  expect(setConceptionChance(a,'r1',25)).toBe(false);expect(event(a)).toBe(savedA);expect(event(b)).toBe(savedB);
  expect(eggsFor(a)[0].event).toBe(savedA);expect(eggsFor(b)[0].event).toBe(savedB);expect(eggsFor(a)[0].fertilized).toBe(false);
  syncBackpackFiles([files[1]]);expect(ledger().byAsset[a]).toBeUndefined();expect(chanceFor(a)).toBe(60);expect(event(b)).toBe(savedB);
  syncBackpackFiles(files);expect(ledger().byAsset[a]).toBeUndefined();clearBackpack();expect(ledger().byAsset).toEqual({});
});

it('records a world-hand delivery for its bound actor after the menu closes',()=>{
  const {a,b}=setup('xr'),t=mount(a,'xrManual');setConceptionChance(a,'r1',100);
  forceOvulation(a,'r1');
  expect(consumePelvicDose(t,inside,true)).toBe('none');bag().select(null);expect(consumePelvicDose(t,inside,true)).toBe('internal');
  const saved=event(a);expect(saved).toMatchObject({chance:100,success:true,target:'vaginal'});expect(event(b)).toBeUndefined();
  advancePelvic(t,.015);expect(consumePelvicDose(t,inside,false)).toBe('none');expect(event(a)).toBe(saved);
});

it('stores fluid without an egg, never backfills it, and stops at three independently fertilized eggs',()=>{
  const {a}=setup(),t=mount(a),draw=vi.spyOn(Math,'random').mockReturnValue(.2);
  setPelvicCapacity(a,8);
  const dose=()=>{queue(a,t,'vaginal');expect(consume(t)).toBe('internal');};
  dose();expect(usePelvic.getState().byAsset[a].fluid.vaginal).toBe(1);expect(ledger().byAsset[a]).toBeUndefined();
  for(let i=1;i<=3;i++){
    expect(forceOvulation(a,'r1')).toBe(true);expect(eggsFor(a)).toHaveLength(i);
    expect(eggsFor(a)[i-1]).toMatchObject({id:i,fertilized:false});expect(eggsFor(a)[i-1].event).toBeUndefined();
  }
  const waiting=eggsFor(a);expect(forceOvulation(a,'r1')).toBe(false);expect(eggsFor(a)).toBe(waiting);expect(draw).not.toHaveBeenCalled();
  const records:NonNullable<ReturnType<typeof event>>[]=[];
  for(let i=1;i<=3;i++){
    dose();records.push(event(a)!);expect(draw).toHaveBeenCalledTimes(i);
    expect(eggsFor(a).filter(e=>e.fertilized).map(e=>e.id)).toEqual([1,2,3].slice(0,i));
    expect(eggsFor(a).map(e=>e.event).slice(0,i)).toEqual(records);
  }
  const settled=ledger();dose();expect(ledger()).toBe(settled);expect(eggsFor(a).map(e=>e.event)).toEqual(records);
  expect(new Set(records.map(e=>e.id)).size).toBe(3);expect(draw).toHaveBeenCalledTimes(3);expect(forceOvulation(a,'r1')).toBe(false);
  expect(usePelvic.getState().byAsset[a].fluid.vaginal).toBe(5);
});
