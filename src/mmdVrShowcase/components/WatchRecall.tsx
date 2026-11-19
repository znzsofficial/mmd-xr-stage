import {useFrame} from '@react-three/fiber';
import {useXRInputSourceState} from '@react-three/xr';
import {useMemo,useRef} from 'react';
import {Group,Quaternion,Vector3} from 'three';
import {HudButton} from './PorcelainControls';
import {useLanguageStore} from '../../languageStore';

/** Mounted directly under XROrigin; XR poses are in that origin's local space.
 * No gesture opens a menu. A ray release over the revealed target is required. */
export function WatchRecall({open}:{open:()=>void}){
  const left=useXRInputSourceState('hand','left'),right=useXRInputSourceState('hand','right');
  const t=useLanguageStore(s=>s.t),ref=useRef<Group>(null),mode=useRef<'wrist'|'below'|null>(null);
  const v=useMemo(()=>({eye:new Vector3(),forward:new Vector3(),at:new Vector3(),q:new Quaternion()}),[]);
  useFrame(({gl},_,frame)=>{
    const g=ref.current;if(!g)return;
    const space=gl.xr.getReferenceSpace(),view=space&&frame?.session.visibilityState==='visible'?frame.getViewerPose(space):null;
    if(!view||!frame||!space){g.visible=false;mode.current=null;return;}
    const {position,orientation}=view.transform;v.eye.copy(position);v.forward.set(0,0,-1).applyQuaternion(v.q.copy(orientation));
    const wrist=left?.inputSource.hand?.get('wrist'),pose=wrist&&right?frame.getPose(wrist,space):null;
    if(pose)v.at.copy(pose.transform.position);
    const raised=pose&&Math.abs(v.at.y-v.eye.y)<.28&&v.at.distanceToSquared(v.eye)<.7**2;
    const next=raised?'wrist':v.forward.y<(mode.current==='below'?-.24:-.44)?'below':null;
    if(next==='wrist'){g.position.copy(v.at);g.position.y+=.095;g.scale.setScalar(.43);}
    else if(next==='below'&&mode.current!==next){g.position.copy(v.eye).addScaledVector(v.forward,1);g.scale.setScalar(.8);}
    g.visible=next!==null;g.pointerEvents=next?'auto':'none';mode.current=next;
    if(next)g.rotation.y=Math.atan2(v.eye.x-g.position.x,v.eye.z-g.position.z);
  });
  return <group ref={ref} name="watch:recall" visible={false} pointerEventsType={{deny:['touch','grab']}} pointerEventsOrder={2}>
    <HudButton position={[0,0,0]} label={t('watchMenu')} size={[.36,.16]} onPress={()=>{if(ref.current?.visible)open();}}/>
  </group>;
}
