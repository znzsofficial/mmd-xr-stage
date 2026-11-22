import { afterEach, expect, it } from 'vitest';
import { Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { clearBackpack, useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useStagePlay } from '../play/stagePlay';
import { makeSilicone } from '../play/workshopModels';
import { siliconeMount, siliconeOutlet, siliconeTilt, centerZ, tipHeight } from '../play/siliconeProfile';
import type { GripFrame } from '../play/propView';
import { mountPelvicRig } from './rig';
import { queuePelvicGrip } from './input';
import { pelvicRailMatrix, registerPelvicSocket, samplePelvicFrame } from './geometry';
import { assignPelvic, enablePelvic, nudgePelvic, patchPelvic, requestPelvicDose, startPelvic, stopPelvic, usePelvic } from './store';

const st=usePelvic.getState,initialStage=useMmdVrStore.getState();
const cleanup:(()=>void)[]=[];
afterEach(()=>{while(cleanup.length)cleanup.pop()!();clearBackpack();useStagePlay.getState().reset();useMmdVrStore.setState(initialStage);useHudWorldInput.setState({blocked:false});});
const grip=():GripFrame=>({at:new Vector3(4,5,6),dir:new Vector3(1,0,0),usable:true,action:'off',dt:1/90});
function actualPiece(){const piece=new Group(),part=new Mesh(makeSilicone(),new MeshBasicMaterial());part.name='play:piece:dildo';
  part.position.fromArray(siliconeMount);part.rotation.x=siliconeTilt;piece.add(part);cleanup.push(()=>{part.geometry.dispose();part.material.dispose();});return piece;}
function fixture(source:'screen'|'xr'){
  const scene=new Scene(),host=new Group(),root=new Group(),piece=actualPiece();scene.add(host,root);host.add(piece);
  root.position.set(-.5,1,-.94);root.rotation.y=.63;root.scale.setScalar(1.1);
  const file=new File(['m'],'fixture.pmx');
  useMmdVrStore.setState({overlayOpen:true,presentation:source,physicsBusy:false,physicsFatal:false,playing:false});
  useBackpack.setState({entries:[{id:'a',kind:'model',file,path:file.name}],selected:'a',live:{a:{runtimeId:'m',visible:true,position:[-.5,.3,-.94],bounds:{center:[-.5,1,-.94],size:[.6,1.815,.4]}}}});
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as unknown as XRSession;
  const emissions:{at:Vector3;dir:Vector3;usable:boolean;action:string}[]=[];
  const emit=(f:GripFrame)=>emissions.push({at:f.at.clone(),dir:f.dir.clone(),usable:f.usable,action:f.action});
  const viewer={tracked:true};const driver=mountPelvicRig({scene,host,getRoot:()=>root,standPiece:()=>piece,standSpray:()=>emit,tracked:()=>viewer.tracked});cleanup.push(driver.dispose);
  const tick=()=>driver.advance(1/90,source==='xr'?{session} as XRFrame:undefined);
  enablePelvic('a',true);tick();expect(st().support.a.kind).toBe('missing');expect(st().support.a.manualSeed!.unitsPerMeter).toBeCloseTo(1);
  patchPelvic('a',{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},pitchDeg:0},clothingClear:true});
  return {scene,root,piece,session,viewer,driver,emissions,emit,tick};
}

it('moves the real stand nozzle along the calibrated curve on a frozen VMD, meters at that nozzle, and closes the thick shell on interruption',()=>{
  const {scene,root,piece,tick,driver,emissions}=fixture('screen');tick();
  expect(st().support.a.kind).toBe('manual');expect(scene.getObjectByName('pelvic:seal')!.visible).toBe(false);
  expect(assignPelvic('a','standManual','screen')).toBe(true);expect(startPelvic('a')).toBe(true);tick();
  requestPelvicDose('a');tick();const drop=emissions.at(-1)!;
  const part=piece.getObjectByName('play:piece:dildo')!,nozzle=part.localToWorld(new Vector3(0,tipHeight,centerZ(tipHeight)));
  expect(drop.action).toBe('start');expect(drop.at.distanceTo(nozzle)).toBeLessThan(1e-7);expect(driver.getStandRoot()).toBe(piece);
  const key=driver.getStandBinding();expect(key).toBeTruthy();
  nudgePelvic('a',2);for(let i=0;i<90;i++)tick();
  expect(st().sample).toMatchObject({outletInside:true,atCervix:true});expect(st().sample!.depth).toBeCloseTo(.092*1.1);
  expect(driver.getAperture()!.amount).toBeGreaterThan(.4);expect(scene.getObjectByName('pelvic:seal')!.visible).toBe(false);
  const e=emissions.filter(x=>x.action==='start').length;requestPelvicDose('a');tick();expect(st().byAsset.a.fluid.vaginal).toBe(1);
  expect(emissions.filter(x=>x.action==='start')).toHaveLength(e);expect(emissions.at(-1)?.usable).toBe(false);
  patchPelvic('a',{showAdapter:true});tick();const shell=scene.getObjectByName('pelvic:seal') as Mesh;
  expect(shell.visible).toBe(true);shell.geometry.computeBoundingBox();expect(shell.geometry.boundingBox!.max.z-shell.geometry.boundingBox!.min.z).toBeGreaterThan(.007);
  function throughLip(x:number){shell.updateWorldMatrix(true,false);return new Raycaster(shell.localToWorld(new Vector3(x,0,.07)),
    new Vector3(0,0,-1).transformDirection(shell.matrixWorld)).intersectObject(shell,false).length;}
  expect(throughLip(.006)).toBe(0);expect(throughLip(.037)).toBeGreaterThan(0);
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
  requestPelvicDose('a');tick();expect(emissions.at(-1)).toMatchObject({action:'start',usable:true});
  requestPelvicDose('a');stopPelvic('a');startPelvic('a');tick();
  // An off action alone still pumps the unsent part of a LiquidSpray pulse.
  expect(emissions.at(-1)).toMatchObject({action:'off',usable:false});
  requestPelvicDose('a');tick();expect(emissions.at(-1)).toMatchObject({action:'start',usable:true});
});

it('holds a verified XR stand through slow chart frames without spending elapsed travel or queued doses; tracking loss retires it',()=>{
  const {driver,tick,piece,session,viewer,emissions}=fixture('xr');tick();assignPelvic('a','standManual','xr');startPelvic('a');tick();
  const slow=(dt:number)=>driver.advance(dt,{session} as XRFrame);
  const outside=piece.matrixWorld.clone();nudgePelvic('a',1);requestPelvicDose('a');slow(.12);slow(.27);
  expect(piece.matrixWorld.equals(outside)).toBe(true);expect(st().sample?.outletInside).toBe(false);expect(emissions.at(-1)?.usable).toBe(false);
  for(let i=0;i<60;i++)tick();const reading=st().sample!,at=piece.matrixWorld.clone(),binding=driver.getStandBinding();
  expect(reading.outletInside).toBe(true);expect(reading.depth).toBeGreaterThan(.06);expect(binding).toBeTruthy();
  requestPelvicDose('a');slow(.12);slow(.251);slow(.36);expect(st().active?.running).toBe(true);expect(st().sample?.depth).toBe(reading.depth);
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
  const {driver,tick}=fixture('screen');tick();assignPelvic('a','standManual','screen');startPelvic('a');requestPelvicDose('a');
  const profile=st().byAsset.a;driver.dispose();
  expect(st().active).toBeNull();expect(useStagePlay.getState().stand).toBeNull();expect(st().support.a).toBeUndefined();
  expect(st().byAsset.a).toBe(profile);
});

it.each([false,true])('drops requests without a mounted nozzle; previously running: %s',wasRunning=>{
  const {piece,tick,emissions}=fixture('screen');tick();assignPelvic('a','standManual','screen');startPelvic('a');if(wasRunning)tick();
  const mount=piece.parent!;piece.removeFromParent();requestPelvicDose('a');tick();mount.add(piece);tick();
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

it('checks a material against the actually skinned garment: lifting it uncovers the port, lowering it interrupts drive even after clothing was confirmed',()=>{
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
  expect(driver.getStandBinding()).toBeNull();expect(driver.getAperture()).toBeNull();expect(requestPelvicDose('a')).toBe(false);
  bone.position.y+=.27;root.updateMatrixWorld(true);tick();expect(st().support.a.obstruction).toBeUndefined();expect(startPelvic('a')).toBe(true);
  tick();expect(driver.getStandBinding()).toBeTruthy();bone.position.y-=.27;root.updateMatrixWorld(true);tick();
  expect(st().support.a.obstruction).toBe('garment');expect(st().active?.running).toBe(false);expect(driver.getStandBinding()).toBeNull();
  m.visible=false;tick();expect(st().support.a.obstruction).toBeUndefined();expect(st().active?.running).toBe(false);
  useStagePlay.getState().stow();useBackpack.getState().select(null);m.visible=true;tick();expect(st().support.a.obstruction).toBeUndefined();
  useBackpack.getState().select('a');tick();expect(st().support.a.obstruction).toBe('garment');g.dispose();m.dispose();
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
