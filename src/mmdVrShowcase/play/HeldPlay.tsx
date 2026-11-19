import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, Matrix4, Vector3 } from 'three';
import { useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { TOYS, type Toy, type Hand } from './propCatalog';
import { canUseGrip, gripLatch, useStagePlay } from './stagePlay';
import type { GripFrame } from './propView';
import * as views from './propViews';
import { StoryStations } from './StoryStations';

export function PlayPiece({toy}:{toy:Toy}) {
  const {Piece}=views[TOYS[toy].view];
  return <Piece/>;
}

function InHand({toy,hand}:{toy:Toy;hand:Hand}) {
  const item=TOYS[toy], {HeldEffect}=views[item.view];
  const body=useRef<Group>(null), effect=useRef<((frame:GripFrame)=>void)|null>(null);
  const scratch=useMemo(()=>({latch:gripLatch(),pose:new Matrix4(),ray:new Matrix4(),source:null as XRInputSource|null,
    frame:{at:new Vector3(),dir:new Vector3(),action:'off',dt:0,usable:false} as GripFrame}),[]);
  useFrame(({gl},delta,frame)=>{
    const prop=body.current;if(!prop)return;
    const session=frame?.session,ref=gl.xr.getReferenceSpace(),s=scratch, f=s.frame;
    let source:XRInputSource|undefined;
    if(session)for(const input of session.inputSources)if(input.handedness===hand&&!input.hand&&input.gripSpace&&input.targetRayMode==='tracked-pointer'){source=input;break;}
    if(!source&&session?.visibilityState==='visible') {
      const play=useStagePlay.getState();if(play.held?.hand===hand&&play.held.toy===toy)play.stow();return;
    }
    const visible=frame&&ref&&session?.visibilityState==='visible';
    const grip=visible&&source?.gripSpace?frame.getPose(source.gripSpace,ref):null;
    const ray=visible&&source?frame.getPose(source.targetRaySpace,ref):null;
    prop.visible=!!grip&&!!ray;
    if(s.source!==(source??null)){s.latch(false,false);s.source=source??null;}
    const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
    f.usable=prop.visible&&canUseGrip(useStagePlay.getState(),toy,hand,stage.prefs.scenery)&&!useHudWorldInput.getState().blocked&&!bag.busy&&!bag.draft&&!bag.selected&&!stage.placeMode&&!stage.assetLoad.running&&!stage.physicsBusy&&!stage.physicsFatal;
    f.action=s.latch(f.usable,!!source?.gamepad?.buttons[1]?.pressed);
    f.dt=Math.min(.05,Math.max(0,delta));
    if(grip&&ray){
      s.pose.fromArray(grip.transform.matrix);s.ray.fromArray(ray.transform.matrix);
      const origin=gl.xr.getCamera().parent;if(origin){origin.updateWorldMatrix(true,false);s.pose.premultiply(origin.matrixWorld);s.ray.premultiply(origin.matrixWorld);}
      prop.position.setFromMatrixPosition(s.pose);prop.quaternion.setFromRotationMatrix(s.ray);
      f.dir.set(0,0,-1).applyQuaternion(prop.quaternion);f.at.set(0,.025,-.177).applyQuaternion(prop.quaternion).add(prop.position);
      if(f.action==='start')item.onGrip?.(f.at,f.dir);
    }
    effect.current?.(f);
  });
  return <group pointerEvents="none"><group ref={body} visible={false}><PlayPiece toy={toy}/></group>
    {HeldEffect&&<HeldEffect ref={effect}/>}</group>;
}

export function StagePlay(){const held=useStagePlay(s=>s.held);
  return <>{held&&<InHand key={`${held.hand}:${held.toy}`} {...held}/>}<StoryStations/></>;
}
