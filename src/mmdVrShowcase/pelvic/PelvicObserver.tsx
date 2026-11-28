import {useFrame} from '@react-three/fiber';
import {useMemo,useRef,type RefObject} from 'react';
import {Group,Vector3} from 'three';
import {useBackpack} from '../backpack/store';
import {useHudWorldInput} from '../hud/hudWorldInput';
import {useMmdVrStore} from '../mmdVrStore';
import {usePelvic} from './store';
import {PelvicLiveSection} from './Section';
import {DepthHudReadout} from './StrokeReadout';
import {PRIVATE_COLORS} from './palette';
import type {PelvicRigHandle} from './PelvicRig';

// Closing the controls frees the holding hand's grip. Leave the section beside
// that actor: it can be read while moving the tool and never consumes a ray.
type ObserverProps={rig:RefObject<PelvicRigHandle|null>};
export function PelvicObserver({rig}:ObserverProps){
  const id=usePelvic(s=>s.active?.mode==='xrManual'?s.active.assetId:null),xr=useMmdVrStore(s=>s.presentation==='xr');
  const live=useBackpack(s=>id?s.live[id]:undefined),panel=useBackpack(s=>!!s.selected||!!s.draft||s.busy);
  const blocked=useHudWorldInput(s=>s.blocked);
  return xr&&id&&live?.visible&&!panel&&!blocked?<SectionStand rig={rig} assetId={id} runtimeId={live.runtimeId}/>:null;
}
function SectionStand({assetId,runtimeId,rig}:{assetId:string;runtimeId:string}&ObserverProps){
  const group=useRef<Group>(null),s=useMemo(()=>({eye:new Vector3(),look:new Vector3(),right:new Vector3(),up:new Vector3(0,1,0)}),[]);
  useFrame(({gl})=>{
    const live=useBackpack.getState().live[assetId],node=group.current;if(!node)return;
    const {active,sample}=usePelvic.getState();
    node.visible=active?.assetId===assetId&&active.runtimeId===runtimeId&&!!sample&&!!live?.visible&&live.runtimeId===runtimeId&&
      gl.xr.isPresenting&&!!rig.current?.getObserverAnchor(node.position);if(!node.visible)return;
    gl.xr.getCamera().getWorldPosition(s.eye);
    const b=live.bounds;
    node.position.y+=.14;
    // Keep the read-only figure legible a step back, without letting it follow
    // the eye or cover the actor at arm's length. The graphic is .42 m wide.
    const width=Math.max(.42,Math.min(.64,node.position.distanceTo(s.eye)*.32));
    node.scale.setScalar(width/.42);
    s.look.subVectors(node.position,s.eye).setY(0);if(s.look.lengthSq()<1e-6)s.look.set(0,0,-1);s.look.normalize();
    s.right.crossVectors(s.look,s.up);
    // Reserve space for the figure even when it has been scaled up. The panel
    // stays upright and actor-relative instead of following the hand or head.
    node.position.addScaledVector(s.right,.11+width/2+Math.max(.12,(b?.size[0]??.5)*.5));
    node.lookAt(s.eye);
  });
  return <group ref={group} visible={false} name="pelvic:observer" pointerEvents="none">
    <PelvicLiveSection assetId={assetId} runtimeId={runtimeId}/>
    <group position-y={-.207} scale={.5} name="pelvic:hand-depth" pointerEvents="none">
      <mesh renderOrder={29} position-z={-.002} raycast={()=>null}><planeGeometry args={[.84,.12]}/>
        <meshBasicMaterial color={PRIVATE_COLORS.paper} toneMapped={false} fog={false} depthTest={false} depthWrite={false}/></mesh>
      <DepthHudReadout assetId={assetId} runtimeId={runtimeId} width={.79}/>
    </group></group>;
}
