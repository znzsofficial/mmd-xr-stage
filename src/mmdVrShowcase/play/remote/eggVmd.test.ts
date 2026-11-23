import { DefaultMmdRuntime,ThreeMmdLoader } from '@yohawing/three-mmd-loader';
import { Group, Scene } from 'three';
import { expect,it,vi } from 'vitest';
import { clearBackpack,useBackpack } from '../../backpack';
import { useMmdVrStore } from '../../mmdVrStore';
import { poseFixture } from '../../pose/poseFixture.testSupport';
import { createRoomPropDisplay } from '../../stage/roomPropDisplay';
import { faceFixture } from '../faceFixture.testSupport';
import { useStagePlay } from '../stagePlay';
import { startEggBinding,stopRemoteEgg } from './remoteMotor';
import { createWearableCollider,mountWearableCollider } from './wearableCollider';

// Deliberately bind the underlying display layer to the very same facial slot.
vi.mock('../../pelvic/apertureConfig',()=>({getApertureMorph:()=> 'Blink'}));

it('unwinds a shared VMD vertex in reverse order both before the next pose and on immediate motor stop',async()=>{
  const face=faceFixture(undefined,['Blink']),pose=new DefaultMmdRuntime({physics:'none'});
  const clip=(await new ThreeMmdLoader().loadAnimation(poseFixture().vmd)).animation;
  pose.setAnimation({...clip,morphTracks:{Blink:clip.morphTracks.Gesture}},face.mesh);
  const scene=new Scene(),receiver=createWearableCollider(),room=createRoomPropDisplay();
  const release=mountWearableCollider(scene,receiver,new Group()),off=room.subscribe(useMmdVrStore.getState().prefs.scenery);
  useBackpack.setState({live:{a:{runtimeId:'runtime-a',visible:true,position:[0,0,0]}}});
  const rig={getAperture:()=>({assetId:'a',runtimeId:'runtime-a',amount:.28}),getActorContact:()=>null,
    getStandRoot:()=>null,getStandBinding:()=>null,getObserverAnchor:()=>false,advance(){},interrupt(){}};
  try{
    useStagePlay.getState().equip('remoteEgg','right');startEggBinding('a');
    for(const t of [.25,.5,.5,.75]){
      pose.evaluate(t,{physics:false});const raw=face.mesh.morphTargetInfluences![0],rawVertex=face.z(0);
      expect(raw).toBeCloseTo(.12+(.83-.12)*t/2);const lower=raw+(1-raw)*.28;
      receiver.begin(face.root,performance.now(),false);room.present({getModelSurface:()=>face},scene,null,rig,undefined,{oldTime:performance.now()});
      expect(face.z(0)).toBeGreaterThan(lower*.1+.002);
      if(t===.75){stopRemoteEgg();expect(face.z(0)).toBeCloseTo(lower*.1,7);}
      room.restore();expect(face.mesh.morphTargetInfluences![0]).toBe(raw);expect(face.z(0)).toBe(rawVertex);
    }
  }finally{off();release();useStagePlay.getState().reset();clearBackpack();face.dispose();}
});
