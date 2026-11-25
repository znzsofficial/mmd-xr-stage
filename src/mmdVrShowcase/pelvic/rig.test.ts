import { afterEach, expect, it } from 'vitest';
import { Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { clearBackpack, useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { useHudWorldInput } from '../hud/hudWorldInput';
import { useStagePlay } from '../play/stagePlay';
import {faceFixture} from '../play/faceFixture.testSupport';
import {createRoomPropDisplay} from '../stage/roomPropDisplay';
import { makeSilicone } from '../play/workshopModels';
import { siliconeMount, siliconeOutlet, siliconeTilt, centerZ, tipHeight } from '../play/siliconeProfile';
import type { GripFrame } from '../play/propView';
import { mountPelvicRig } from './rig';
import { queuePelvicGrip } from './input';
import {fitRows,type Fit} from './fitRows';
import {setAtlasView} from './atlas/view';
import { pelvicRailMatrix, registerPelvicSocket, samplePelvicFrame } from './geometry';
import { assignPelvic, clearRailTechnique, enablePelvic, nudgePelvic, patchPelvic, requestPelvicDose, requestStrokeDose, saveRailTechnique,
   setActorResponse, setPelvicAdapter, startPelvic, startRailTechnique, stopPelvic, usePelvic } from './store';

const st=usePelvic.getState,initialStage=useMmdVrStore.getState();
const cleanup:(()=>void)[]=[];
afterEach(()=>{while(cleanup.length)cleanup.pop()!();clearBackpack();useStagePlay.getState().reset();useMmdVrStore.setState(initialStage);useHudWorldInput.setState({blocked:false});});
const grip=():GripFrame=>({at:new Vector3(4,5,6),dir:new Vector3(1,0,0),usable:true,action:'off',dt:1/90});
function actualPiece(){const piece=new Group(),part=new Mesh(makeSilicone(),new MeshBasicMaterial());part.name='play:piece:dildo';
  part.position.fromArray(siliconeMount);part.rotation.x=siliconeTilt;piece.add(part);cleanup.push(()=>{part.geometry.dispose();part.material.dispose();});return piece;}
function fixture(source:'screen'|'xr',face?:ReturnType<typeof faceFixture>){
  const scene=new Scene(),host=new Group(),root=face?.root??new Group(),piece=actualPiece();scene.add(host,root);host.add(piece);
  root.position.set(-.5,1,-.94);root.rotation.y=.63;root.scale.setScalar(1.1);
  const file=new File(['m'],'fixture.pmx');
  useMmdVrStore.setState({overlayOpen:true,presentation:source,physicsBusy:false,physicsFatal:false,playing:false});
  useBackpack.setState({entries:[{id:'a',kind:'model',file,path:file.name}],selected:'a',live:{a:{runtimeId:'m',visible:true,position:[-.5,.3,-.94],bounds:{center:[-.5,1,-.94],size:[.6,1.815,.4]}}}});
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as unknown as XRSession;
  const emissions:{at:Vector3;dir:Vector3;usable:boolean;action:string}[]=[];
  const emit=(f:GripFrame)=>emissions.push({at:f.at.clone(),dir:f.dir.clone(),usable:f.usable,action:f.action});
  const viewer={tracked:true};const driver=mountPelvicRig({scene,host,getRoot:()=>root,getSurface:()=>face??null,standPiece:()=>piece,standSpray:()=>emit,tracked:()=>viewer.tracked});cleanup.push(driver.dispose);
  const tick=()=>driver.advance(1/90,source==='xr'?{session} as XRFrame:undefined);
  enablePelvic('a',true);tick();expect(st().support.a.kind).toBe('missing');expect(st().support.a.manualSeed!.unitsPerMeter).toBeCloseTo(1);
  patchPelvic('a',{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},pitchDeg:0}});patchPelvic('a',{clothingClear:true});
  return {scene,root,piece,session,viewer,driver,emissions,emit,tick};
}

it('moves the real stand nozzle along the calibrated curve on a frozen VMD, meters at that nozzle, and closes the thick shell on interruption',()=>{
  const {scene,root,piece,tick,driver,emissions}=fixture('screen');tick();
  expect(st().support.a.kind).toBe('manual');expect(scene.getObjectByName('pelvic:seal')!.visible).toBe(false);
  expect(assignPelvic('a','standManual','screen')).toBe(true);expect(startPelvic('a')).toBe(true);tick();
  requestPelvicDose('a','external');tick();const drop=emissions.at(-1)!;
  const part=piece.getObjectByName('play:piece:dildo')!,nozzle=part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight)));
  expect(drop.action).toBe('start');expect(drop.at.distanceTo(nozzle)).toBeLessThan(1e-7);expect(driver.getStandRoot()).toBe(piece);
  const key=driver.getStandBinding();expect(key).toBeTruthy();
  nudgePelvic('a',2);for(let i=0;i<90;i++)tick();
  expect(st().sample).toMatchObject({outletInside:true,atCervix:true});expect(st().sample!.depth).toBeCloseTo(.092*1.1);
  expect(driver.getAperture()!.amount).toBeGreaterThan(.4);expect(scene.getObjectByName('pelvic:seal')!.visible).toBe(false);
  const e=emissions.filter(x=>x.action==='start').length;requestPelvicDose('a','vaginal');tick();expect(st().byAsset.a.fluid.vaginal).toBe(1);
  expect(emissions.filter(x=>x.action==='start')).toHaveLength(e);expect(emissions.at(-1)?.usable).toBe(false);
  setPelvicAdapter('a','m',true);tick();const shell=scene.getObjectByName('pelvic:seal') as Mesh;
  expect(shell.visible).toBe(true);shell.geometry.computeBoundingBox();expect(shell.geometry.boundingBox!.max.z-shell.geometry.boundingBox!.min.z).toBeGreaterThan(.007);
  function throughLip(x:number){shell.updateWorldMatrix(true,false);return new Raycaster(shell.localToWorld(new Vector3(x,0,.07)),
    new Vector3(0,0,-1).transformDirection(shell.matrixWorld)).intersectObject(shell,false).length;}
  // Probe the actual lateral tissue rather than the previous wide profile's
  // 37 mm footprint. The 6 mm point switches from a hole to tissue on stop.
  expect(throughLip(.006)).toBe(0);expect(throughLip(.021)).toBeGreaterThan(0);
  const before=nozzle.copy(part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight))));root.position.x+=.006;tick();
  expect(part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight))).x-before.x).toBeCloseTo(.006);expect(driver.getStandBinding()).toBe(key);
  const anchor=new Vector3();expect(driver.getObserverAnchor(anchor)).toBe(true);expect(anchor.distanceTo(root.position)).toBeLessThan(1e-7);
  driver.interrupt();expect(driver.getStandBinding()).toBeNull();expect(driver.getAperture()).toBeNull();expect(st().active?.running).toBe(false);
  expect(driver.getObserverAnchor(anchor)).toBe(false);
  tick();expect(throughLip(.006)).toBeGreaterThan(0);
  patchPelvic('a',{calibration:{pitchDeg:12,offsetM:[.005,0,0]}});tick();expect(scene.getObjectByName('pelvic:seal')).toBe(shell);
});

it('cuts an exterior pulse even when stop and restart both happen between two render frames',()=>{
  const {tick,emissions}=fixture('screen');tick();assignPelvic('a','standManual','screen');startPelvic('a');
  tick();requestPelvicDose('a','external');tick();expect(emissions.at(-1)).toMatchObject({action:'start',usable:true});
  requestPelvicDose('a','external');stopPelvic('a');startPelvic('a');tick();
  // An off action alone still pumps the unsent part of a LiquidSpray pulse.
  expect(emissions.at(-1)).toMatchObject({action:'off',usable:false});
  requestPelvicDose('a','external');tick();expect(emissions.at(-1)).toMatchObject({action:'start',usable:true});
});

it('records only a fresh opted-in crossing, not enabling memory or restarting inside; room teardown retains only local memory',()=>{
  const {tick,driver}=fixture('screen');patchPelvic('a',{clothed:true});tick();
  const frames=(n:number)=>{for(let i=0;i<n;i++)tick();};
  assignPelvic('a','standManual','screen');tick();startPelvic('a');nudgePelvic('a',.87);frames(60);
  expect(st().sample?.outletInside).toBe(true);expect(st().byAsset.a.rimMemory).toBeUndefined();
  patchPelvic('a',{rimMode:'remember'});frames(15);expect(st().byAsset.a.rimMemory).toBeUndefined();
  stopPelvic('a');tick();expect(st().parkedSample!.tip[2]).toBeLessThan(0);
  setAtlasView('a',{foldStyle:'defined',degrees:90});startPelvic('a');frames(12);
  expect(st().sample?.outletInside).toBe(false);expect(st().byAsset.a.rimMemory).toBeUndefined();
  nudgePelvic('a',-2);frames(55);expect(st().sample?.railHome).toBe(true);
  nudgePelvic('a',.87);frames(55);expect(st().byAsset.a.rimMemory).toBe('center');
  const saved=st().byAsset.a;nudgePelvic('a',-2);frames(55);nudgePelvic('a',.87);frames(55);
  expect(st().byAsset.a).toBe(saved);expect(saved.fluid).toEqual({vaginal:0,fantasyUterine:0});
  driver.dispose();setAtlasView('a',{foldStyle:'soft',degrees:0});expect(st().active).toBeNull();expect(st().byAsset.a).toBe(saved);
});

it.each(['screen','xr'] as const)('delivers one motor order at the physical nozzle on %s, never spraying, while VMD is paused',source=>{
  const {root,piece,tick,emissions}=fixture(source);patchPelvic('a',{clothed:true});tick();
  assignPelvic('a','standAuto',source);tick();startPelvic('a');tick();const token=st().active!.token;
  const order=()=>requestStrokeDose('a',token,'fantasyUterine');
  const part=piece.getObjectByName('play:piece:dildo')!,c=st().byAsset.a.calibration,f=samplePelvicFrame(registerPelvicSocket(root,c),c)!;
  const tip=()=>part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight))).applyMatrix4(f.inverse);
  expect(tip().z).toBeGreaterThan(.04);expect(order()).toBe(true);expect(order()).toBe(false);expect(st().strokeOrder?.phase).toBe('waiting');
  for(let i=0;i<80&&st().strokeOrder;i++){
    tick();expect(st().byAsset.a.fluid.fantasyUterine).toBe(st().sample?.outletInside?1:0);
  }
  expect(tip().z).toBeLessThan(0);expect(st().strokeReceipt).toBe('delivered');
  expect(order()).toBe(true);expect(st().strokeOrder?.phase).toBe('dispatched');tick();expect(st().byAsset.a.fluid.fantasyUterine).toBe(2);
  for(let i=0;i<400;i++)tick();expect(emissions.some(e=>e.action==='start')).toBe(false);expect(st().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:2});
});

it.each(['lost tracking','obstructed','long frame','target','selection','room','stop','actor jump'] as const)(
  'drops an outside motor order on %s; a future valid crossing cannot spend it',cause=>{
    const {root,viewer,session,tick,driver,emissions}=fixture('xr');
    const skirt=new Mesh(new BoxGeometry(.14,.14,.004),new MeshBasicMaterial({name:'Pleated Skirt',visible:false}));
    skirt.position.z=.022;root.add(skirt);cleanup.push(()=>{skirt.geometry.dispose();skirt.material.dispose();});tick();
    assignPelvic('a','standAuto','xr');tick();startPelvic('a');tick();const token=st().active!.token;
    expect(requestStrokeDose('a',token,'vaginal')).toBe(true);
    if(cause==='lost tracking'){viewer.tracked=false;tick();viewer.tracked=true;}
    if(cause==='obstructed'){skirt.material.visible=true;for(let i=0;i<4;i++)tick();expect(st().support.a.obstruction).toBe('garment');skirt.material.visible=false;}
    if(cause==='long frame')driver.advance(.18,{session} as XRFrame);
    if(cause==='target'){patchPelvic('a',{container:'fantasyUterine'});patchPelvic('a',{container:'vaginal'});}
    if(cause==='selection'){useBackpack.setState({selected:'other'});useBackpack.setState({selected:'a'});}
    if(cause==='room'){const stage=useMmdVrStore.getState();stage.setPrefs({scenery:stage.prefs.scenery==='pool'?'floor':'pool'});}
    if(cause==='stop')stopPelvic('a');
    if(cause==='actor jump'){root.position.x+=.25;tick();} // a discontinuity, even if the rail stays aligned
    expect(st().strokeOrder).toBeNull();tick();if(!st().active)assignPelvic('a','standAuto','xr');startPelvic('a');
    for(let i=0;i<200;i++)tick();expect(st().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:0});expect(emissions.some(e=>e.action==='start')).toBe(false);
  });

it('holds a verified XR stand through slow chart frames without spending elapsed travel or queued doses; tracking loss retires it',()=>{
  const {driver,tick,piece,session,viewer,emissions}=fixture('xr');tick();assignPelvic('a','standManual','xr');startPelvic('a');tick();
  const slow=(dt:number)=>driver.advance(dt,{session} as XRFrame);
  const outside=piece.matrixWorld.clone();nudgePelvic('a',1);requestPelvicDose('a','external');slow(.12);slow(.27);
  expect(piece.matrixWorld.equals(outside)).toBe(true);expect(st().sample?.outletInside).toBe(false);expect(emissions.at(-1)?.usable).toBe(false);
  for(let i=0;i<60;i++)tick();const reading=st().sample!,at=piece.matrixWorld.clone(),binding=driver.getStandBinding();
  expect(reading.outletInside).toBe(true);expect(reading.depth).toBeGreaterThan(.06);expect(binding).toBeTruthy();
  requestPelvicDose('a','vaginal');slow(.12);slow(.251);slow(.36);expect(st().active?.running).toBe(true);expect(st().sample?.depth).toBe(reading.depth);
  expect(piece.matrixWorld.equals(at)).toBe(true);expect(driver.getStandBinding()).toBe(binding);expect(driver.getAperture()!.amount).toBeGreaterThan(0);
  tick();expect(st().byAsset.a.fluid.vaginal).toBe(0);expect(emissions.some(x=>x.action==='start')).toBe(false);
  viewer.tracked=false;slow(.16);viewer.tracked=true;tick();expect(st().sample).toBeNull();expect(st().active?.running).toBe(false);
});

it.each(['anchor','drift','rod','hidden','new token'] as const)('rejects a long stand interval with changed %s instead of reseeding inside',change=>{
  const {driver,tick,root,piece}=fixture('screen');tick();assignPelvic('a','standAuto','screen');startPelvic('a');for(let i=0;i<50;i++)tick();
  expect(st().sample?.outletInside).toBe(true);
  if(change==='anchor')root.rotation.y+=.001;
  if(change==='rod')piece.getObjectByName('play:piece:dildo')!.position.y+=.002;
  if(change==='hidden')piece.getObjectByName('play:piece:dildo')!.visible=false;
  if(change==='new token'){stopPelvic('a');startPelvic('a');}
  if(change==='drift')for(let i=0;i<10;i++){root.position.x+=3e-8;driver.advance(.18);}
  else driver.advance(.18);
  expect(st().active?.running).toBe(false);expect(st().sample).toBeNull();expect(driver.getStandRoot()).toBeNull();expect(st().byAsset.a.fluid.vaginal).toBe(0);
});

it('releases the stand and its queued dose on teardown, including a start after the last rendered frame',()=>{
  const {driver,tick}=fixture('screen');tick();assignPelvic('a','standManual','screen');startPelvic('a');expect(requestPelvicDose('a','external')).toBe(false);
  const profile=st().byAsset.a;driver.dispose();
  expect(st().active).toBeNull();expect(useStagePlay.getState().stand).toBeNull();expect(st().support.a).toBeUndefined();
  expect(st().byAsset.a).toBe(profile);
});

it.each([false,true])('drops requests without a mounted nozzle; previously running: %s',wasRunning=>{
  const {piece,tick,emissions}=fixture('screen');tick();assignPelvic('a','standManual','screen');startPelvic('a');if(wasRunning)tick();
  const mount=piece.parent!;piece.removeFromParent();expect(requestPelvicDose('a','external')).toBe(wasRunning);tick();mount.add(piece);tick();
  expect(st().active?.running).toBe(!wasRunning);expect(emissions.filter(f=>f.action==='start')).toHaveLength(0);
});

it('uses only the current physical grip; rejects reacquisition behind the port, cancels an exterior plume immediately inside, and invalidates a queued frame on transfer',()=>{
  const {scene,root,piece,session,tick,driver}=fixture('xr');tick();expect(assignPelvic('a','xrManual','xr','left')).toBe(true);
  startPelvic('a');useBackpack.getState().select(null);
  const held=actualPiece();scene.add(held);held.userData={propUsable:true,heldToy:'dildo',propSource:{handedness:'left',gripSpace:{}},trackingEpoch:0};
  const c=st().byAsset.a.calibration,f=samplePelvicFrame(registerPelvicSocket(root,c),c)!;
  const emits:GripFrame[]=[];
  function step(d:number,squeeze:boolean,sameFrame=true){
    pelvicRailMatrix(f,d).decompose(held.position,held.quaternion,held.scale);held.updateWorldMatrix(true,false);
    const untouched=held.matrixWorld.clone(),frame={session} as XRFrame;
    const g=grip();g.action=squeeze?'start':'off';held.userData.propFrame=frame;
    expect(queuePelvicGrip(scene,held,frame,g,v=>emits.push({...v,at:v.at.clone(),dir:v.dir.clone()}))).toBe(true);
    driver.advance(1/90,sameFrame?frame:{session} as XRFrame);
    expect(held.matrixWorld.equals(untouched)).toBe(true);return frame;
  }
  step(-.02,false);step(-.01,true);expect(emits.at(-1)?.action).toBe('start');
  expect(emits.at(-1)!.at.distanceTo(held.localToWorld(new Vector3(...siliconeOutlet.position)))).toBeLessThan(1e-7);
  step(.001,true);expect(st().sample?.outletInside).toBe(true);expect(st().byAsset.a.fluid.vaginal).toBe(1);
  expect(emits.at(-1)).toMatchObject({usable:false,action:'off'});expect(driver.getStandRoot()).toBeNull();expect(piece.visible).toBe(false);
  session.dispatchEvent(new Event('inputsourceschange'));expect(st().active?.running).toBe(false);expect(driver.getAperture()).toBeNull();
  startPelvic('a');session.dispatchEvent(new Event('visibilitychange'));expect(st().active?.running).toBe(false); // start and loss before a render
  startPelvic('a');step(.008,true);expect(st().sample).toMatchObject({outletInside:false,outletVisible:false});
  expect(emits.at(-1)).toMatchObject({usable:false,action:'off'});expect(st().byAsset.a.fluid.vaginal).toBe(1);
  step(-.025,true,false);expect(st().active?.running).toBe(false);
  const old=st().byAsset.a.fluid.vaginal;useStagePlay.getState().equip('feather','left');
  expect(queuePelvicGrip(scene,held,{session} as XRFrame,grip(),null)).toBe(false);expect(st().byAsset.a.fluid.vaginal).toBe(old);
});

it('checks live skinned clothing, suppressing surface effects without cancelling an admitted stroke when a lifted skirt drops',()=>{
  const {root,driver,tick}=fixture('screen');
  const g=new BoxGeometry(.13,.13,.006),n=g.getAttribute('position').count;
  g.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(n*4),4));
  const w=new Float32Array(n*4);for(let i=0;i<n;i++)w[i*4]=1;g.setAttribute('skinWeight',new Float32BufferAttribute(w,4));
  const m=new MeshBasicMaterial({name:'Pleated Skirt'}),mesh=new SkinnedMesh(g,m),bone=new Bone();
  root.add(mesh);mesh.add(bone);bone.position.y=.4;mesh.updateMatrixWorld(true);mesh.bind(new Skeleton([bone]));
  // Establish skin bind matrices in their real placed/scaled reference.
  root.updateMatrixWorld(true);mesh.bind(new Skeleton([bone]));bone.position.z=.031;
  tick();expect(st().support.a).toMatchObject({obstruction:'garment',blockerName:'Pleated Skirt',garmentNames:['Pleated Skirt']});expect(assignPelvic('a','standManual','screen')).toBe(true);expect(startPelvic('a')).toBe(false);
  tick();const standby=st().parkedSample!;
  expect(standby.tip[2]).toBeGreaterThan(0);expect(standby).toMatchObject({aligned:true,depth:0,outletInside:false,outletVisible:false});
  expect(driver.getStandBinding()).toBeNull();expect(driver.getAperture()).toBeNull();expect(requestPelvicDose('a','external')).toBe(false);
  bone.position.y+=.27;root.updateMatrixWorld(true);tick();expect(st().support.a.obstruction).toBeUndefined();expect(startPelvic('a')).toBe(true);
  tick();expect(requestPelvicDose('a','external')).toBe(true);
  bone.position.y-=.27;root.updateMatrixWorld(true);driver.advance(.28);
  expect(st().sample).toMatchObject({exteriorCovered:true,outletVisible:false});expect(requestPelvicDose('a','external')).toBe(false);
  expect(st().active?.running).toBe(true);bone.position.y+=.27;root.updateMatrixWorld(true);tick();
  setPelvicAdapter('a','m',true);nudgePelvic('a',.65);for(let i=0;i<60;i++)tick();
  expect(driver.getStandBinding()).toBeTruthy();expect(driver.getAperture()).toBeTruthy();bone.position.y-=.27;root.updateMatrixWorld(true);tick();
  expect(st().support.a.obstruction).toBe('garment');expect(st().active?.running).toBe(true);expect(st().sample?.outletInside).toBe(true);expect(driver.getAperture()).toBeNull();
  m.visible=false;tick();expect(st().support.a.obstruction).toBeUndefined();expect(driver.getAperture()).toBeTruthy();stopPelvic('a');setPelvicAdapter('a','m',false);
  useStagePlay.getState().stow();useBackpack.getState().select(null);m.visible=true;tick();expect(st().support.a.obstruction).toBeUndefined();
  useBackpack.getState().select('a');tick();expect(st().support.a.obstruction).toBe('garment');g.dispose();m.dispose();
});

it('keeps a fitted shell armed through covering, uncovering and re-covering without a rod or exposure confirmation',()=>{
  const {root,scene,tick}=fixture('screen');const g=new BoxGeometry(.20,.20,.004),m=new MeshBasicMaterial({name:'Pleated Skirt'});
  const skirt=new Mesh(g,m);root.add(skirt);cleanup.push(()=>{g.dispose();m.dispose();});
  patchPelvic('a',{clothed:true});tick();const shell=scene.getObjectByName('pelvic:seal')!,shown=()=>shell.visible&&shell.parent!.visible;
  expect(st().support.a.obstruction).toBe('garment');expect(setPelvicAdapter('a','stale',true)).toBe(false);
  expect(setPelvicAdapter('a','m',true)).toBe(true);tick();expect(shown()).toBe(false);
  useBackpack.getState().select(null);skirt.position.y=.35;tick();expect(shown()).toBe(true);
  skirt.position.y=0;tick();expect(shown()).toBe(false);expect(st().byAsset.a).toMatchObject({showAdapter:true,clothingClear:false,clothed:true});
  useBackpack.getState().select('a');expect(setPelvicAdapter('a','m',false)).toBe(true);m.visible=false;tick();expect(shown()).toBe(false);
  expect(st().active).toBeNull();expect(useStagePlay.getState().stand).toBeNull();
});

it.each(['screen','xr'] as const)('moves and resets the mounted shell with the %s fit controls while retiring the old contact and exposure',source=>{
  const {scene,tick,driver,emissions}=fixture(source);tick();
  const rows=(fit:Fit)=>fitRows({assetId:'a',runtimeId:'m',source,fit,profile:st().byAsset.a,support:st().support.a,l:(_,en)=>en,
    setFit(){},morph:null,names:[],page:0,setPage(){},clothes(){},clear(){}});
  const press=(label:string)=>{const k=rows('model').flatMap(r=>r.kind==='buttons'?r.keys:[]).find(k=>k.label===label)!;expect(k.disabled).not.toBe(true);k.press();};
  press('Fit vulva attachment to skin');tick();const shell=scene.getObjectByName('pelvic:seal')!,at=()=>shell.getWorldPosition(new Vector3());
  const shown=()=>shell.visible&&shell.parent!.visible,origin=at();expect(shown()).toBe(true);
  assignPelvic('a','standManual',source);startPelvic('a');nudgePelvic('a',.65);for(let i=0;i<60;i++)tick();
  expect(requestPelvicDose('a','vaginal')).toBe(true);emissions.length=0;
  const left=rows('position').find(r=>r.kind==='field'&&r.label==='Left / right');if(left?.kind!=='field')throw Error('missing lateral offset');left.change(.5);
  tick();expect(shown()).toBe(true);expect(at().distanceTo(origin)).toBeCloseTo(.005*1.1,7);expect(startPelvic('a')).toBe(false);
  expect(st().parkedSample).toMatchObject({depth:0,railHome:true,outletInside:false});expect(driver.getActorContact()).toBeNull();
  patchPelvic('a',{clothed:true});startPelvic('a');tick();expect(st().sample).toMatchObject({outletInside:false,exteriorCovered:true});
  expect(requestPelvicDose('a','external')).toBe(false);nudgePelvic('a',.65);for(let i=0;i<60;i++)tick();
  expect(st().sample?.outletInside).toBe(true);expect(st().byAsset.a.fluid.vaginal).toBe(0);expect(emissions.some(f=>f.usable)).toBe(false);
  press('Reset opening fit');tick();expect(at().distanceTo(origin)).toBeLessThan(1e-7);expect(shown()).toBe(true);
  expect(st().byAsset.a).toMatchObject({showAdapter:true,clothingClear:false,clothed:false});expect(st().active?.running).toBe(false);
  press('Use bone position');tick();expect(st().support.a.kind).toBe('missing');expect(shown()).toBe(false);
  press('Set origin manually');tick();expect(shown()).toBe(true);
  press('Turn off vulva attachment');press('Reset opening fit');tick();expect(shown()).toBe(false);
});

it.each(['Pleated Skirt','Body with painted outfit'])('supports an explicit clothed crossing with %s without opening the surface or spraying under it',name=>{
  const {root,scene,tick,driver,viewer,emissions}=fixture('xr');const g=new BoxGeometry(.14,.14,.004),m=new MeshBasicMaterial({name});
  root.add(new Mesh(g,m));cleanup.push(()=>{g.dispose();m.dispose();});patchPelvic('a',{clothingClear:false});tick();
  expect(st().support.a.obstruction).toBe(name==='Pleated Skirt'?'garment':undefined);
  assignPelvic('a','standManual','xr');tick();expect(startPelvic('a')).toBe(false);
  patchPelvic('a',{clothed:true,container:'fantasyUterine'});expect(startPelvic('a')).toBe(true);
  tick();nudgePelvic('a',.9);expect(requestPelvicDose('a','fantasyUterine')).toBe(false);expect(requestPelvicDose('a','external')).toBe(false);
  expect(st().sample).toMatchObject({exteriorCovered:true,outletVisible:false,outletInside:false});
  for(let i=0;i<60;i++)tick();expect(st().sample!.depth).toBeGreaterThan(.04);expect(requestPelvicDose('a','fantasyUterine')).toBe(true);tick();
  expect(st().byAsset.a).toMatchObject({clothingClear:false,fluid:{vaginal:0,fantasyUterine:1}});expect(m.visible).toBe(true);
  expect(scene.getObjectByName('pelvic:seal')!.visible).toBe(false);expect(driver.getAperture()).toBeNull();expect(emissions.some(f=>f.usable)).toBe(false);
  requestPelvicDose('a','fantasyUterine');viewer.tracked=false;tick();viewer.tracked=true;tick();
  expect(st().sample).toBeNull();expect(st().active?.running).toBe(false);expect(st().byAsset.a.fluid.fantasyUterine).toBe(1);
});

it('draws an unconfirmed mount, measures its physical nozzle and carriage, and clears the stationary diagram on unload',()=>{
  const {root,scene,piece,tick}=fixture('screen');patchPelvic('a',{clothingClear:false});tick();
  assignPelvic('a','standAuto','screen');tick();
  const actual=piece.getObjectByName('play:piece:dildo')!,anchor=scene.getObjectByName('pelvic:adapter:a')!,stand=scene.getObjectByName('pelvic:stand')!;
  const tip=()=>anchor.worldToLocal(actual.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight))));
  expect(piece.visible&&stand.visible).toBe(true);expect(tip().z).toBeGreaterThan(0);
  expect(new Vector3(...st().parkedSample!.tip).distanceTo(tip())).toBeLessThan(1e-6);expect(st().sample).toBeNull();
  for(let i=0;i<4;i++){root.position.z+=.04;tick();}expect(new Vector3(...st().parkedSample!.tip).distanceTo(tip())).toBeLessThan(1e-6);
  expect(startPelvic('a')).toBe(false);useStagePlay.getState().stow();tick();expect(stand.visible||piece.visible).toBe(false);
  expect(st().parkedSample).toBeNull();
});

it.each(['stop/restart','tracking','actor','room','off/on','swap'] as const)('restores the actual clothed stand actor on %s without forwarding the last admitted frame',cause=>{
  const face=faceFixture(), {scene,session,viewer,driver,tick}=fixture('xr',face);
  const display=createRoomPropDisplay(),stage=useMmdVrStore.getState(),unmount=display.subscribe(stage.prefs.scenery);
  cleanup.push(face.dispose,unmount);
  face.root.updateMatrixWorld(true);
  face.mesh.morphTargetInfluences![0]=.2;face.body.morphTargetInfluences![2]=.2;
  const baseline=[0,1,2,3].map(face.z),unchanged=()=>expect([0,1,2,3].map(face.z)).toEqual(baseline);
  let time=0;
  const frame=()=>{display.restore();unchanged();tick();time+=1000/90;display.present({getModelSurface:()=>face},scene,null,driver,{session} as XRFrame,{oldTime:time});};
  patchPelvic('a',{clothed:true});frame();expect(st().support.a.responseMorphs).toEqual(['Blink','MouthOpen','なごみ','Smile']);
  expect(assignPelvic('a','standManual','xr')).toBe(true);frame();unchanged();expect(driver.getActorContact()).toBeNull();
  startPelvic('a');nudgePelvic('a',.9);
  let entered=false,belowHudRate=false;
  for(let i=0;i<54;i++){const last=st().sample;frame();const c=driver.getActorContact();
    if(c?.motion==='enter'){entered=true;expect(face.z(0)).toBeGreaterThan(.095);}
    if(c?.motion==='inside'&&last===st().sample&&last&&Math.abs(c.depthM*1.1-last.depth)>.0003)belowHudRate=true;
  }
  expect(entered&&belowHudRate).toBe(true);expect(face.z(1)+face.z(2)).toBeGreaterThan(.025);expect(driver.getAperture()).toBeNull();
  if(cause==='stop/restart'){stopPelvic('a');unchanged();startPelvic('a');}
  if(cause==='tracking'){viewer.tracked=false;frame();viewer.tracked=true;}
  if(cause==='actor')useBackpack.setState({selected:'other'});
  if(cause==='room')useMmdVrStore.setState({prefs:{...stage.prefs,scenery:stage.prefs.scenery==='pool'?'floor':'pool'}});
  if(cause==='off/on'){setActorResponse('a','m',null);unchanged();setActorResponse('a','m',undefined);}
  if(cause==='swap')expect(setActorResponse('a','m','Smile')).toBe(true);
  unchanged();
  for(let i=0;i<4;i++){frame();unchanged();} // no withdrawal animation or delayed tap
  if(cause==='swap'){
    nudgePelvic('a',-2);for(let i=0;i<55;i++){frame();unchanged();}
    nudgePelvic('a',.9);let seen=false;
    for(let i=0;i<35;i++){frame();if(driver.getActorContact()?.motion==='enter'){
      expect(face.z(3)).toBeCloseTo(.095);expect(face.z(0)).toBe(baseline[0]);seen=true;
    }}expect(seen).toBe(true);
  }
});

it.each(['screen','xr'] as const)('records and replays the mounted %s nozzle, including a real held stall and an unfinished withdrawal on paused VMD',source=>{
  const {root,piece,tick,driver,session,emissions}=fixture(source);patchPelvic('a',{clothed:true});tick();
  assignPelvic('a','standManual',source);expect(startRailTechnique('a','record')).toBe(false);tick();
  const frame=(dt:number)=>driver.advance(dt,source==='xr'?{session} as XRFrame:undefined);
  const part=piece.getObjectByName('play:piece:dildo')!,c=st().byAsset.a.calibration,socket=registerPelvicSocket(root,c);
  const tip=()=>part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight))).applyMatrix4(samplePelvicFrame(socket,c)!.inverse);
  const repeat=(n:number,dt:number)=>{for(let i=0;i<n;i++)frame(dt);};
  expect(startRailTechnique('a','record')).toBe(true);nudgePelvic('a',.8);frame(1/60);
  expect(saveRailTechnique('a')).toBe(false);const home=tip();expect(home.z).toBeGreaterThan(.04);
  repeat(12,1/60);const midway=tip();repeat(12,1/60);const deep=tip();
  expect(deep.z).toBeLessThan(midway.z-.02);expect(st().sample?.outletInside).toBe(true);
  expect(requestPelvicDose('a','vaginal')).toBe(true);repeat(18,1/60);
  nudgePelvic('a',-2);frame(.24);expect(tip().distanceTo(deep)).toBeLessThan(1e-7); // target is already home
  repeat(6,1/60);const end=tip();expect(end.z).toBeGreaterThan(deep.z+.01);expect(end.z).toBeLessThan(-.01);
  expect(saveRailTechnique('a')).toBe(true);const saved=st().byAsset.a.technique!;
  expect(saved.seconds).toBeCloseTo(1.04,6);expect(Math.max(...saved.positions)).toBeCloseTo(.6,6);expect(saved.positions.at(-1)).toBeCloseTo(.4,6);
  expect(st().byAsset.a.fluid.vaginal).toBe(1);tick();expect(st().parkedSample?.railHome).toBe(false);
  startPelvic('a');tick();expect(startRailTechnique('a','replay')).toBe(false); // already running, behind the opening
  nudgePelvic('a',-2);repeat(30,1/60);expect(st().sample?.railHome).toBe(true);
  root.position.x+=.31;root.rotation.y+=.23;patchPelvic('a',{replayRate:2});
  expect(startRailTechnique('a','replay')).toBe(true);frame(1/30);
  expect(driver.getActorContact()).toBeNull();expect(tip().distanceTo(home)).toBeLessThan(1e-7);expect(nudgePelvic('a',1)).toBe(false);
  repeat(3,1/30);expect(tip().distanceTo(midway)).toBeLessThan(.0001);
  expect(requestPelvicDose('a','vaginal')).toBe(true);frame(.24);expect(tip().distanceTo(midway)).toBeLessThan(.0001); // no catch-up or deferred dose
  repeat(3,1/30);expect(tip().distanceTo(deep)).toBeLessThan(.0001);
  repeat(7,1/30);expect(tip().distanceTo(deep)).toBeLessThan(.0001); // duration includes the verified .24 s hold
  repeat(5,1/30);expect(st().active?.running).toBe(false);expect(tip().distanceTo(end)).toBeLessThan(.0001);
  expect(driver.getActorContact()).toBeNull();expect(emissions.some(e=>e.action==='start')).toBe(false);expect(st().byAsset.a.fluid.vaginal).toBe(1);
  expect(clearRailTechnique('a')).toBe(true);expect(st().byAsset.a.technique).toBeUndefined();expect(st().byAsset.a.fluid.vaginal).toBe(1);
});

function shortInsideTake(withGarment=false){
  const f=fixture('xr'),skirt=withGarment?new Mesh(new BoxGeometry(.14,.14,.004),new MeshBasicMaterial({name:'Pleated Skirt',visible:false})):null;
  if(skirt){skirt.position.z=.022;f.root.add(skirt);cleanup.push(()=>{skirt.geometry.dispose();skirt.material.dispose();});}
  f.tick();assignPelvic('a','standManual','xr');f.tick();
  expect(startRailTechnique('a','record')).toBe(true);nudgePelvic('a',.65);for(let i=0;i<37;i++)f.tick();
  expect(st().sample?.outletInside).toBe(true);expect(saveRailTechnique('a')).toBe(true);f.tick();
  startPelvic('a');nudgePelvic('a',-2);for(let i=0;i<40;i++)f.tick();expect(st().sample?.railHome).toBe(true);return {...f,skirt};
}
it('physically returns an inside-ending loop through the opening before the next entrance; never replays response edges at a seam',()=>{
  const {driver,tick,piece}=shortInsideTake();patchPelvic('a',{replayLoop:true,replayRate:1.5});
  expect(startRailTechnique('a','replay')).toBe(true);const part=piece.getObjectByName('play:piece:dildo')!;
  let entered=0,left=0,home=true,prev:Vector3|null=null;
  for(let i=0;i<200;i++){
    tick();const at=part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight)));
    if(prev)expect(at.distanceTo(prev)).toBeLessThan(.012);prev=at;
    if(st().sample?.railHome)home=true;
    const motion=driver.getActorContact()?.motion;
    if(motion==='enter'){expect(home).toBe(true);expect(left).toBe(entered);home=false;entered++;}
    if(motion==='withdraw'){left++;expect(entered).toBe(left);}
  }
  expect(entered).toBeGreaterThan(2);expect(st().byAsset.a.fluid.vaginal).toBe(0);
});

it.each([
  ['record','stop'],['replay','tracking'],['record','takeover'],['replay','actor'],['record','room'],
  ['replay','calibration'],['replay','garment'],['replay','dispose'],
] as const)('retires %s on %s without overwriting the actor’s saved take or completing a pending release',(operation,cause)=>{
  const {skirt,tick,viewer,driver}=shortInsideTake(cause==='garment'),clip=st().byAsset.a.technique;
  patchPelvic('a',{replayLoop:true});expect(startRailTechnique('a',operation)).toBe(true);
  if(operation==='record')nudgePelvic('a',.8);
  for(let i=0;i<28;i++)tick();expect(st().sample?.outletInside).toBe(true);expect(requestPelvicDose('a','vaginal')).toBe(true);
  if(cause==='stop')stopPelvic('a');
  if(cause==='tracking'){viewer.tracked=false;tick();viewer.tracked=true;}
  if(cause==='takeover')useStagePlay.getState().equip('feather','left');
  if(cause==='actor'){useBackpack.setState({selected:'other'});useBackpack.setState({selected:'a'});}
  if(cause==='room'){const s=useMmdVrStore.getState();s.setPrefs({scenery:s.prefs.scenery==='floor'?'pool':'floor'});}
  if(cause==='calibration')patchPelvic('a',{calibration:{pitchDeg:15}});
  if(cause==='garment'){
    // Material visibility changes on an existing indexed surface, not a
    // fabricated UI obstruction. A fresh bare-only take cannot run under it.
    expect(st().support.a.obstruction).toBeUndefined();skirt!.material.visible=true;for(let i=0;i<4;i++)tick();
    expect(st().support.a.obstruction).toBe('garment');skirt!.material.visible=false;
  }
  if(cause==='dispose')driver.dispose();
  for(let i=0;i<3;i++)tick();expect(st().active?.take).toBeUndefined();expect(st().active?.running).not.toBe(true);
  expect(driver.getActorContact()).toBeNull();expect(saveRailTechnique('a')).toBe(false);
  expect(st().byAsset.a.technique).toBe(clip);expect(st().byAsset.a.fluid.vaginal).toBe(0);
});

it('reuses only track data for the same backpack asset in a new presentation, calibration and actor root',()=>{
  const old=shortInsideTake();const clip=st().byAsset.a.technique!;old.driver.dispose();
  expect(st().support.a).toBeUndefined();expect(st().active).toBeNull();expect(JSON.parse(JSON.stringify(clip))).toEqual(clip);
  const bag=useBackpack.getState(),b={...bag.entries[0],id:'b'},a=bag.live.a;
  useMmdVrStore.setState({presentation:'screen'});useBackpack.setState({entries:[...bag.entries,b],live:{a:{...a,runtimeId:'new'},b:{...a,runtimeId:'copy'}}});
  useBackpack.getState().select('b');enablePelvic('b',true);expect(st().byAsset.b.technique).toBeUndefined();useBackpack.getState().select('a');
  patchPelvic('a',{calibration:{pitchDeg:-8,lengthM:.11}});patchPelvic('a',{clothed:true});
  const scene=new Scene(),host=new Group(),root=new Group(),piece=actualPiece();scene.add(host,root);host.add(piece);
  root.position.set(.45,.77,-1.2);root.rotation.y=-.41;root.scale.setScalar(.95);
  const room=mountPelvicRig({scene,host,getRoot:id=>id==='new'?root:null,standPiece:()=>piece,standSpray:()=>null});cleanup.push(room.dispose);
  const frame=()=>room.advance(1/60);frame();expect(st().byAsset.a.technique).toBe(clip);
  expect(assignPelvic('a','standManual','screen')).toBe(true);expect(startRailTechnique('a','replay')).toBe(false);frame();
  expect(startRailTechnique('a','replay')).toBe(true);let entered=false;
  for(let i=0;i<23;i++){frame();entered||=room.getActorContact()?.motion==='enter';}
  expect(entered).toBe(true);expect(st().sample?.outletInside).toBe(true);expect(st().sample?.lengthM).toBeCloseTo(.11*.95);
  useBackpack.setState({entries:[b]});expect(st().active).toBeNull();expect(st().byAsset.a).toBeUndefined();
});
