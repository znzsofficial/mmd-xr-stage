import {useThree} from '@react-three/fiber';
import {useLayoutEffect,useMemo,useRef} from 'react';
import type {Group} from 'three';
import {useMmdVrStore} from '../../mmdVrStore';
import {noPick} from '../../scenery/sceneryPaint';
import {useStagePlay} from '../stagePlay';
import {EYELET_NAME,REEL_NAME,registerEyelet} from './kiteFlight';
import {GUIDE,REEL_OFFSET,makeReel} from './kiteModels';

export function KiteReel() {
  const scene = useThree(s => s.scene), eyelet = useRef<Group>(null);
  const spool = useMemo(makeReel, []);
  useLayoutEffect(() => registerEyelet(scene, eyelet.current!), [scene]);
  useLayoutEffect(() => () => spool.dispose(), [spool]);
  return <group name={REEL_NAME} position={REEL_OFFSET} pointerEvents="none">
    <mesh geometry={spool} raycast={noPick}><meshStandardMaterial vertexColors roughness={.83}/></mesh>
    <group ref={eyelet} name={EYELET_NAME} position={GUIDE}/>
  </group>;
}

/** The city bench is scenery; only its screen quick cue flies from this reel. */
export function BenchReel({seat,height}:{seat:{x:number;z:number;yaw:number};height:number}){
  const screen=useMmdVrStore(s=>s.presentation==='screen');
  const held=useStagePlay(s=>s.held?.toy==='kite');
  const onWrist=useStagePlay(s=>s.character?.toy==='kite');
  if(onWrist||(held&&!screen))return null;
  return <group name="story:bench-reel" position={[seat.x,height,seat.z]} rotation-y={seat.yaw} pointerEvents="none" userData={{playerCollision:false}}><KiteReel/></group>;
}
