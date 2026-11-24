// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { expect,it,vi } from 'vitest';
import { useLanguageStore } from '../../../languageStore';
import { clearBackpack,useBackpack } from '../../backpack/store';
import { useMmdVrStore } from '../../mmdVrStore';
import { EggFields,fitScreenEgg } from '../../screen/ContactPropFields';
import { createRoomPropDisplay } from '../../stage/roomPropDisplay';
import { faceFixture } from '../faceFixture.testSupport';
import { mountHeldColliderSource } from '../propColliders';
import { useStagePlay } from '../stagePlay';
import { checkEggTracking,watchEggSession } from './eggTracking';
import { useRemoteEgg } from './remoteMotor';
import { createWearableCollider,mountWearableCollider,presentRemoteWearable } from './wearableCollider';

it('wear button drives the actual shell and split-face vertices on a frozen actor without Bullet; stop, transfer and lost tracking leave no display residue',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const t=useLanguageStore.getState().t;
  const a=faceFixture(undefined,['Blink','Skirt','Tint']),b=faceFixture(undefined,['Blink ribbon','SkirtUp','Smile sweater']);
  const bodies=[a,b].map(f=>{const m=new Mesh(new BoxGeometry(.4,1.65,.22),new MeshBasicMaterial());f.root.add(m);return m;});
  const scene=new Scene(),shell=new Group(),source=createWearableCollider(),hand=new Group();scene.add(a.root,b.root,shell,hand);
  const release=mountWearableCollider(scene,source,shell),display=createRoomPropDisplay(),off=display.subscribe(useMmdVrStore.getState().prefs.scenery);
  const bag=useBackpack.getState(),motor=useRemoteEgg.getState;
  const entries=['a','b'].map(id=>({id,kind:'model' as const,file:new File([],id+'.pmx'),path:id+'.pmx'}));
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries,live:{a:live('A'),b:live('B')},selected:'a'});
  const host=document.createElement('div'),ui=createRoot(host);document.body.append(host);
  const sheet=(id:string)=>act(()=>{bag.select(id);ui.render(<EggFields id={id} locked={false}/>);});
  const click=(label:string)=>act(()=>{const key=[...host.querySelectorAll('button')].find(k=>k.textContent===label);expect(key?.disabled).toBe(false);key!.click();});
  const selected=()=>[...host.querySelectorAll('[role="group"] button[aria-pressed="true"]')].map(k=>k.textContent);
  const runtime={getModelSurface:(id:string)=>id==='A'?a:id==='B'?b:null};
  a.mesh.morphTargetInfluences![0]=.33;a.body.morphTargetInfluences![1]=.22;
  const baseline=a.z(0),restored=()=>{expect(a.z(0)).toBe(baseline);expect(a.mesh.morphTargetInfluences![0]).toBe(.33);};
  const tick=(ms:number)=>{
    now=ms;display.restore();restored();const id=motor().assetId;
    source.begin(id==='a'?a.root:id==='b'?b.root:null,now,false);presentRemoteWearable(scene);
    display.present(runtime,scene,null,null,undefined,{oldTime:now});
    return shell.localToWorld(new Vector3(.002,-.078,.015)); // bottom of the real shell's loop
  };
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as XRSession;
  const unwatch=watchEggSession(session,()=>false),unhand=mountHeldColliderSource(scene,hand,session);
  try{
    await sheet('a');expect(host.querySelectorAll('button')).toHaveLength(1);await click(t('eggWear'));
    expect(selected()).toEqual([t('eggSteady')]);
    const peak=tick(0),face=a.z(0);expect(face).toBeGreaterThan(baseline+.025);expect(shell.visible).toBe(true);
    expect(tick(370).distanceTo(peak)).toBeGreaterThan(.01);expect(a.z(0)).toBeLessThan(face-.01);
    await click(t('eggRamp'));expect(selected()).toEqual([t('eggRamp')]);const start=now;tick(start);const early=a.z(0);
    const crest=tick(start+2220);expect(a.z(0)).toBeGreaterThan(early+.025);
    await click(t('eggRamp'));expect(tick(now).distanceTo(crest)).toBe(0);expect(a.z(0)).toBeGreaterThan(early+.025);
    await click(t('eggPulse'));expect(selected()).toEqual([t('eggPulse')]);tick(now);expect(a.z(0)).toBeGreaterThan(early);
    const gap=tick(now+400);restored();await click(t('eggPulse'));expect(selected()).toEqual([t('eggPulse')]);expect(tick(now+180).distanceTo(gap)).toBe(0);
    tick(now+300);expect(a.z(0)).toBeGreaterThan(early);
    await click(t('eggStop'));expect(selected()).toEqual([]);restored();const stopped=shell.matrix.clone();expect(shell.visible).toBe(true);
    expect(fitScreenEgg('a')).toBe(true);tick(now+200);expect(shell.matrix.elements).toEqual(stopped.elements);restored();
    for(const label of ['eggPulse','eggSteady','eggRamp'] as const){
      await click(t(label));expect(selected()).toEqual([t(label)]);tick(now);expect(a.z(0)).toBeGreaterThan(baseline);
      if(label!=='eggRamp'){await click(t('eggStop'));restored();}
    }
    await sheet('b');expect(motor().assetId).toBe('a');expect(b.z(0)).toBe(0);
    await click(t('eggTransfer'));restored();expect(shell.visible).toBe(false);
    const unsupported=tick(now);expect(shell.visible).toBe(true);expect(tick(now+370).distanceTo(unsupported)).toBeGreaterThan(.01);
    expect(b.mesh.morphTargetInfluences).toEqual([0,0,0]);expect(b.body.morphTargetInfluences).toEqual([0,0,0]);
    await sheet('a');await click(t('eggTransfer'));tick(now);
    const frame={session} as XRFrame;
    Object.assign(hand.userData,{heldToy:'remoteEgg',propFrame:frame,propUsable:false,propSource:{handedness:'right',gripSpace:{}}});
    checkEggTracking(scene,frame);expect(motor().mode).toBe(1); // actor menu is open, but grip and ray are still current
    await act(()=>checkEggTracking(scene,{session} as XRFrame));restored();expect(shell.visible).toBe(true);
    checkEggTracking(scene,frame);tick(now+100);expect(motor().mode).toBe(0);restored();
    await click(t('eggSteady'));tick(now);await act(()=>{Object.assign(session,{visibilityState:'hidden'});session.dispatchEvent(new Event('visibilitychange'));});
    restored();expect(motor().mode).toBe(0);
    await click(t('eggRemove'));expect(shell.visible).toBe(false);expect(motor().assetId).toBeNull();
  }finally{
    await act(()=>ui.unmount());host.remove();unhand();unwatch();off();release();useStagePlay.getState().reset();clearBackpack();
    a.dispose();b.dispose();for(const m of bodies){m.geometry.dispose();m.material.dispose();}vi.restoreAllMocks();vi.unstubAllGlobals();
  }
});
