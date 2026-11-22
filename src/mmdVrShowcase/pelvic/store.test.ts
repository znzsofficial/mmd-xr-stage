import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { clearBackpack, useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { giveScreenToy, useStagePlay } from '../play/stagePlay';
import { siliconeOutlet } from '../play/siliconeProfile';
import { createPelvicSolver, pelvicRailMatrix } from './geometry';
import {prepareFirstStand} from './firstStand';
import {
  advancePelvic, assignPelvic, cancelStrokeDose, clearPelvicFluid, clearPelvicSupport, consumePelvicDose, disablePelvic, drainPelvic,
  enablePelvic, endPelvic, interruptPelvic, nudgePelvic, patchPelvic, PELVIC_LIMITS, publishPelvicSample,
  publishPelvicSupport, requestPelvicDose, requestStrokeDose, setPelvicCapacity, setPelvicGarmentVisible, startPelvic, stopPelvic, usePelvic, type PelvicSupport,
} from './store';

const get=usePelvic.getState,bag=useBackpack.getState,play=useStagePlay.getState;
const initialStage=useMmdVrStore.getState();
const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
const support=(runtimeId:string):PelvicSupport=>({runtimeId,kind:'bones',anchorName:'lower body'});
function setup(source:'screen'|'xr'='screen'){
  useMmdVrStore.setState({overlayOpen:true,presentation:source,physicsBusy:false,physicsFatal:false});
  useBackpack.setState({entries:['a','b','furniture'].map((id,i)=>({id,kind:i===2?'object':'model',file:new File(['p'],'same.pmx'),path:'same.pmx'})),
    selected:'a',live:{a:live('1'),b:live('2'),furniture:live('object')}});
  publishPelvicSupport('a',support('1'));publishPelvicSupport('b',support('2'));
}
function opted(source:'screen'|'xr'='screen'){
  setup(source);expect(enablePelvic('a',true)).toBe(true);patchPelvic('a',{clothingClear:true});
}
const token=()=>get().active!.token;
const inside={outletInside:true,outletVisible:false}, external={outletInside:false,outletVisible:true}, occluded={outletInside:false,outletVisible:false};
// Store-only fixtures: publish the last HUD reading, then pass the independent
// current render-frame reading to consume. rig.test covers the actual meshes.
function reading(outlet:typeof inside){publishPelvicSample(token(),{tip:[0,0,outlet.outletInside?-.02:.04],tail:[0,0,.1],depth:outlet.outletInside?.02:0,
  shaft:[[0,0,.1],[0,0,0]],radiusM:.024,lengthM:.09,angleDeg:0,aligned:true,atCervix:false,...outlet});}
beforeEach(()=>useHudWorldInput.setState({blocked:false}));
afterEach(()=>{clearBackpack();play().reset();useHudWorldInput.setState({blocked:false});useMmdVrStore.setState(initialStage);});

it('keeps calibration on explicitly enabled model assets; changing selection or enabling another model never takes the prop',()=>{
  setup();giveScreenToy('a','wand','left','floor');const wrist=play().character;
  expect(enablePelvic('a')).toBe(false);expect(enablePelvic('b',true)).toBe(false);
  bag().select('furniture');expect(enablePelvic('furniture',true)).toBe(false);bag().select('a');
  expect(enablePelvic('a',true)).toBe(true);
  const offset:[number,number,number]=[.03,0,-.04];patchPelvic('a',{calibration:{offsetM:offset,pitchDeg:900,lengthM:NaN}});offset[0]=9;
  expect(get().byAsset.a.calibration).toMatchObject({offsetM:[.03,0,-.04],pitchDeg:90,lengthM:.092});
  bag().select('b');expect(enablePelvic('b',true)).toBe(true);expect(play().character).toBe(wrist);
  expect(patchPelvic('a',{clothingClear:true})).toBe(false);expect(get().byAsset.b.calibration.offsetM).toEqual([0,0,0]);
  bag().select('a');expect(assignPelvic('a','standManual','screen')).toBe(true);
  expect(play()).toMatchObject({stand:{assetId:'a',toy:'dildo'},held:null,character:null});expect(startPelvic('a')).toBe(false);
  const t=token();bag().select('b');expect(get().active?.assetId).toBe('a');expect(play().stand?.assetId).toBe('a');
  expect(assignPelvic('b','standAuto','screen')).toBe(true);expect(endPelvic(t)).toBe(false);
  giveScreenToy('a','feather','right','floor');expect(get().active).toBeNull();expect(play().stand).toBeNull();
  expect(play().character).toMatchObject({assetId:'a',toy:'feather'});expect(disablePelvic('b')).toBe(true);
  expect(get().byAsset.b).toBeUndefined();expect(get().byAsset.a.calibration.offsetM[0]).toBe(.03);
});

it('waits for the target controls to close for a real tracked hand; B and tracking recovery never implicitly restart',()=>{
  opted('xr');assignPelvic('a','xrManual','xr','left');expect(play().held).toEqual({hand:'left',toy:'dildo'});
  startPelvic('a');expect(get().active).toMatchObject({running:false,awaitingWorld:true});
  expect(consumePelvicDose(token(),inside,true)).toBe('none');bag().select(null);expect(get().active?.running).toBe(true);
  expect(consumePelvicDose(token(),inside,true)).toBe('internal');expect(consumePelvicDose(token(),external,true)).toBe('none');expect(requestPelvicDose('a','vaginal')).toBe(false);
  const old=token();useHudWorldInput.setState({blocked:true});expect(startPelvic('a')).toBe(false);useHudWorldInput.setState({blocked:false});
  expect(consumePelvicDose(old,inside,true)).toBe('none');expect(get().active?.running).toBe(false);
  bag().select('a');startPelvic('a');bag().select(null);const t=token();expect(consumePelvicDose(t,external,true)).toBe('external');
  interruptPelvic(t);advancePelvic(t,.015);expect(get().active?.running).toBe(false);expect(get().byAsset.a.fluid.vaginal).toBe(1);
  // Another tool can take this same controller while its old frame is pending.
  play().equip('saber','left');expect(get().active).toBeNull();expect(endPelvic(t)).toBe(false);expect(play().held?.toy).toBe('saber');
});

it('cancels first placement if selection leaves and returns before the room publishes its fit',()=>{
  setup();usePelvic.setState({support:{}});prepareFirstStand('a','1','screen');
  bag().select('b');bag().select('a');publishPelvicSupport('a',support('1'));
  expect(get().active).toBeNull();expect(play().stand).toBeNull();expect(get().byAsset.a).toBeDefined();
});

it('gates clothing and tracks measured geometry separately from commands, including on a paused screen clock',()=>{
  opted();assignPelvic('a','standManual','screen');publishPelvicSupport('a',{...support('1'),obstruction:'garment'});
  expect(startPelvic('a')).toBe(false);publishPelvicSupport('a',support('1'));startPelvic('a');
  nudgePelvic('a',900);const t=token();
  const frame={world:new Matrix4(),inverse:new Matrix4(),scale:1,lengthM:.092,radiusM:.024}, solver=createPelvicSolver();
  const step=()=>solver.step(frame,pelvicRailMatrix(frame,advancePelvic(t,.016)*frame.lengthM),{dt:.016});
  expect(step().outletLocal.z).toBeGreaterThan(0);for(let i=0;i<40;i++)step();
  expect(step()).toMatchObject({inside:true,outletInside:true,atCervix:true});
  const tip:[number,number,number]=[.2,0,.1];
  publishPelvicSample(t,{tip,tail:[0,0,.2],shaft:[tip],depth:0,radiusM:.021,lengthM:.095,angleDeg:12,aligned:false,outletInside:false,atCervix:false});
  tip[0]=0;expect(get().sample).toMatchObject({depth:0,tip:[.2,0,.1],shaft:[[.2,0,.1]],outletInside:false});
  const last=get().sample!;publishPelvicSample(t,{...last,...external});publishPelvicSample(t,{...last,...occluded});
  expect(get().sample?.outletVisible).toBe(false); // immediate despite the UI sampling window
  expect(requestPelvicDose('a','vaginal')).toBe(false);publishPelvicSupport('a',{...support('1'),obstruction:'unverified'});
  expect(get().active?.running).toBe(true);expect(consumePelvicDose(t,inside)).toBe('none');
  publishPelvicSupport('a',{...support('1'),kind:'missing'});expect(get().active?.running).toBe(false);expect(get().sample).toBeNull();
  publishPelvicSupport('a',support('1'));assignPelvic('a','standAuto','screen');patchPelvic('a',{speedHz:1,stroke:.6});
  expect(startPelvic('a')).toBe(true);const clock=token();advancePelvic(clock,.01);
  const positions=Array.from({length:100},()=>advancePelvic(clock,.01));
  expect(Math.max(...positions)).toBeCloseTo(.6,6);expect(positions[99]).toBeCloseTo(PELVIC_LIMITS.position[0],6);
  const moving=advancePelvic(clock,.04);stopPelvic('a');expect(advancePelvic(token(),.03)).toBe(moving);
  expect(nudgePelvic('a',.2)).toBe(false);startPelvic('a');const restarted=token();advancePelvic(restarted,1);expect(get().active?.running).toBe(false);
  expect(advancePelvic(restarted,.01)).toBe(PELVIC_LIMITS.position[0]);
});

it('forwards only the selected actor’s real clothing layers to material visibility and never treats hiding as admission',()=>{
  opted();const setMaterialVisible=vi.fn();
  const layer={name:'skirt',visible:true,opacity:1,metallic:0,roughness:1,occlusion:1,emission:0,emissionColor:'#000',envInfluence:0,
    lightingModel:'toon' as const,specularMode:'mmd' as const,aoMapFile:null,emissionMapFile:null,maskMapFile:null};
  useMmdVrStore.setState({materialModels:{'1':[layer]},runtimeRef:{setMaterialVisible,setMaterialOverride:vi.fn()}});
  publishPelvicSupport('a',{...support('1'),garmentNames:['skirt'],obstruction:'garment',blockerName:'skirt'});
  assignPelvic('a','standAuto','screen');expect(setPelvicGarmentVisible('a','face',false)).toBe(false);expect(setPelvicGarmentVisible('b','skirt',false)).toBe(false);
  expect(setPelvicGarmentVisible('a','skirt',false)).toBe(true);expect(setMaterialVisible).toHaveBeenLastCalledWith('1','skirt',false);
  expect(get().byAsset.a.clothingClear).toBe(false);expect(get().support.a.obstruction).toBe('garment');
  publishPelvicSupport('a',{...support('1'),garmentNames:['skirt']});expect(startPelvic('a')).toBe(false);
  patchPelvic('a',{clothingClear:true});expect(startPelvic('a')).toBe(true);expect(setPelvicGarmentVisible('a','skirt',true)).toBe(true);
  expect(setMaterialVisible).toHaveBeenLastCalledWith('1','skirt',true);expect(get().active?.running).toBe(false);expect(get().byAsset.a.clothingClear).toBe(false);
});

it('routes each dose from the actual outlet once; containers, overflow, draining and clearing conserve their own balances',()=>{
  opted();assignPelvic('a','standManual','screen');startPelvic('a');const t=token();
  // Last displayed geometry can lag: even with an external readout the new sample may be inside.
  reading(external);expect(requestPelvicDose('a','vaginal')).toBe(false);requestPelvicDose('a','external');expect(consumePelvicDose(t,external)).toBe('external');expect(consumePelvicDose(t,inside)).toBe('none');
  advancePelvic(t,.014);requestPelvicDose('a','external');requestPelvicDose('a','external');expect(consumePelvicDose(t,occluded)).toBe('none');
  advancePelvic(t,.014);expect(consumePelvicDose(t,external)).toBe('none'); // no deferred spray on recovery
  setPelvicCapacity('a',1.5);
  reading(inside);const dose=()=>{requestPelvicDose('a',get().byAsset.a.container);advancePelvic(t,.014);expect(consumePelvicDose(t,inside)).toBe('internal');};dose();dose();
  expect(get().byAsset.a).toMatchObject({fluid:{vaginal:1.5,fantasyUterine:0},overflow:.5,drained:0});
  patchPelvic('a',{container:'fantasyUterine'});dose();dose();dose();setPelvicCapacity('a',2);
  expect(get().byAsset.a).toMatchObject({fluid:{vaginal:1.5,fantasyUterine:2},overflow:1.5});
  drainPelvic('a',.6);clearPelvicFluid('a');expect(get().byAsset.a).toMatchObject({fluid:{vaginal:1.5,fantasyUterine:0},overflow:1.5,drained:.6});
  requestPelvicDose('a','fantasyUterine');stopPelvic('a');startPelvic('a');expect(consumePelvicDose(token(),inside)).toBe('none');
});

it('never substitutes another destination when the nozzle crosses or the player changes target between click and delivery',()=>{
  opted();assignPelvic('a','standManual','screen');startPelvic('a');const t=token();
  expect(requestPelvicDose('a','external')).toBe(false);nudgePelvic('a',1);expect(requestPelvicDose('a','vaginal')).toBe(false);
  reading(external);expect(requestPelvicDose('a','external')).toBe(true);expect(consumePelvicDose(t,inside)).toBe('none');
  reading(inside);expect(requestPelvicDose('a','vaginal')).toBe(true);expect(consumePelvicDose(t,external)).toBe('none');
  requestPelvicDose('a','vaginal');patchPelvic('a',{container:'fantasyUterine'});expect(requestPelvicDose('a','vaginal')).toBe(false);
  expect(consumePelvicDose(t,inside)).toBe('none');expect(get().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:0});
});

it('distinguishes the actual current admission from a queued inward pass and never carries a dispatched dose past withdrawal',()=>{
  opted();assignPelvic('a','standAuto','screen');startPelvic('a');const t=token(),ask=()=>requestStrokeDose('a',t,'vaginal');
  const frame=(outlet:typeof inside,motion:'outside'|'withdraw'|'inside'|'enter')=>{advancePelvic(t,.015);return consumePelvicDose(t,{...outlet,motion});};
  reading(inside);frame(external,'outside');expect(ask()).toBe(true);const first=get().strokeOrder!;expect(first.phase).toBe('waiting');
  expect(ask()).toBe(false);expect(requestPelvicDose('a','external')).toBe(false);expect(cancelStrokeDose(first.id)).toBe(true);
  expect(ask()).toBe(true);expect(cancelStrokeDose(first.id)).toBe(false);expect(frame(external,'outside')).toBe('none');
  // Crossing the plane can precede the first physically usable nozzle by a frame.
  expect(frame(occluded,'enter')).toBe('none');expect(frame(inside,'inside')).toBe('internal');expect(get().strokeOrder).toBeNull();
  reading(external);expect(ask()).toBe(true);expect(get().strokeOrder?.phase).toBe('dispatched');
  expect(frame(external,'withdraw')).toBe('none');expect(get().strokeReceipt).toBe('missed');expect(frame(inside,'enter')).toBe('none');
  expect(get().byAsset.a.fluid).toEqual({vaginal:1,fantasyUterine:0});
});

it.each(['missed pass','deadline','slowed motor'] as const)('retires a single automatic pass at its %s, even when the HUD keeps reporting inside',cause=>{
  opted();assignPelvic('a','standAuto','screen');patchPelvic('a',{speedHz:1});startPelvic('a');const t=token();
  advancePelvic(t,.01);reading(inside);expect(requestStrokeDose('a',t,'vaginal')).toBe(true);const q=get().strokeOrder!;
  if(cause==='deadline'){
    const clock=vi.spyOn(performance,'now').mockReturnValue(q.deadline+1);
    try{expect(consumePelvicDose(t,{...inside,motion:'enter'})).toBe('none');}finally{clock.mockRestore();}
  }else{
    if(cause==='slowed motor')patchPelvic('a',{speedHz:.1});
    for(let i=0;i<150&&get().strokeOrder;i++){advancePelvic(t,.01);expect(consumePelvicDose(t,{...external,motion:'outside'})).toBe('none');}
  }
  expect(get().strokeReceipt).toBe(cause==='missed pass'?'missed':'expired');expect(get().strokeOrder).toBeNull();
  advancePelvic(t,.01);expect(consumePelvicDose(t,{...inside,motion:'enter'})).toBe('none');expect(get().byAsset.a.fluid.vaginal).toBe(0);
});

it('consumes but never dispenses an unverified or over-stop trigger, including on two subsequent confirmed frames',()=>{
  opted('xr');assignPelvic('a','xrManual','xr');startPelvic('a');bag().select(null);
  const dt=1/72,t=token(),solver=createPelvicSolver(),f={world:new Matrix4(),inverse:new Matrix4(),scale:1,lengthM:.092,radiusM:.024};
  function frame(d:number,press=false,overrunM=0){
    advancePelvic(t,dt);const m=pelvicRailMatrix(f,d);
    if(overrunM){const v=new Vector3(...siliconeOutlet.direction).transformDirection(m).multiplyScalar(overrunM);m.premultiply(new Matrix4().makeTranslation(v));}
    const contact=solver.step(f,m,{dt});return {...contact,route:consumePelvicDose(t,contact,press)};
  }
  // First tracked sample is already behind the opening: geometry alone cannot admit it.
  expect(frame(.01,true)).toMatchObject({...occluded,route:'none'});
  expect(frame(-.012)).toMatchObject({...external,route:'none'});
  expect(frame(.003)).toMatchObject({...inside,route:'none'});
  expect(frame(.02,true)).toMatchObject({...inside,route:'internal'});
  for(const d of [.04,.06,.08,f.lengthM])frame(d);
  // The real hand can move past the hard stop. A retained contact flag and a
  // capped depth readout are not evidence of a usable outlet on this frame.
  expect(frame(f.lengthM,true,.007)).toMatchObject({...occluded,inside:true,atCervix:true,route:'none'});
  expect(frame(.079)).toMatchObject({...inside,route:'none'});expect(frame(.06)).toMatchObject({...inside,route:'none'});
  for(const d of [.04,.02,.002])frame(d);
  expect(frame(-.01,true)).toMatchObject({...external,route:'external'});
  expect(get().byAsset.a).toMatchObject({fluid:{vaginal:1,fantasyUterine:0},overflow:0});
});

it('invalidates queued work on hide, replacement, room change and exit; page calibrations do not retain live support or tool handles',()=>{
  opted();assignPelvic('a','standManual','screen');startPelvic('a');const t=token();reading(inside);requestPelvicDose('a','vaginal');
  const old=get().support.a;bag().publishLive({a:{...live('1'),visible:false}});
  expect(get().active).toBeNull();expect(get().support.a).toBeUndefined();expect(play().stand).toBeNull();
  bag().publishLive({a:live('3')});const next=support('3');publishPelvicSupport('a',next);clearPelvicSupport('a',old);
  expect(get().support.a).toBe(next);assignPelvic('a','standAuto','screen');startPelvic('a');expect(consumePelvicDose(t,inside)).toBe('none');
  useMmdVrStore.getState().setPrefs({scenery:'pool'});expect(get().active).toBeNull();expect(get().support).toEqual({});
  const profile=get().byAsset.a;publishPelvicSupport('a',support('3'));assignPelvic('a','standAuto','screen');startPelvic('a');
  useMmdVrStore.setState({overlayOpen:false});expect(get().active).toBeNull();expect(play().stand).toBeNull();expect(get().byAsset.a).toBe(profile);
  clearBackpack();expect(get().byAsset).toEqual({});
});

it('isolates balances and pending doses across actor transfers and a return to a room with reused runtime IDs',()=>{
  opted();assignPelvic('a','standManual','screen');startPelvic('a');const first=token();
  reading(inside);requestPelvicDose('a','vaginal');consumePelvicDose(first,inside);requestPelvicDose('a','vaginal');
  bag().select('b');enablePelvic('b',true);patchPelvic('b',{clothingClear:true,container:'fantasyUterine'});
  assignPelvic('b','standManual','screen');startPelvic('b');const second=token();
  expect(consumePelvicDose(second,inside)).toBe('none');
  reading(inside);setPelvicCapacity('b',1);for(let i=0;i<2;i++){advancePelvic(second,.016);requestPelvicDose('b','fantasyUterine');consumePelvicDose(second,inside);}
  requestPelvicDose('b','fantasyUterine');const oldB=get().support.b;
  const room=useMmdVrStore.getState().prefs.scenery;useMmdVrStore.getState().setPrefs({scenery:room==='pool'?'floor':'pool'});
  useMmdVrStore.getState().setPrefs({scenery:room});expect(assignPelvic('b','standManual','screen')).toBe(false);
  publishPelvicSupport('b',support('2'));assignPelvic('b','standManual','screen');startPelvic('b');clearPelvicSupport('b',oldB);
  expect(consumePelvicDose(token(),inside)).toBe('none');expect(endPelvic(first)).toBe(false);expect(endPelvic(second)).toBe(false);
  expect(get().active?.running).toBe(true);expect(get().byAsset.a).toMatchObject({fluid:{vaginal:1,fantasyUterine:0},overflow:0});
  expect(get().byAsset.b).toMatchObject({fluid:{vaginal:0,fantasyUterine:1},overflow:1});
});
