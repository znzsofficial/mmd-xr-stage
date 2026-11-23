import {Raycaster,type Mesh,type WebGLRenderer} from 'three';
import {useHudWorldInput} from '../components/hudWorldInput';
import {xrPoseSampler} from '../pose/xrPoseSample';

/** A native selectstart normally has its own active frame. The pointer
 * library can deliver its first down inside a later animation callback. Use
 * that callback's active frame only when the event frame itself has expired;
 * a valid event-frame miss or tracking loss must not fall back to an old hit. */
export function milkPressFrame(gl:WebGLRenderer,session:XRSession,source:XRInputSource,event?:XRFrame){
  if(!event)return gl.xr.getFrame()??undefined;
  if(event.session!==session)return undefined;
  const space=gl.xr.getReferenceSpace();if(!space)return undefined;
  try{event.getPose(source.targetRaySpace,space);return event;}
  catch(error){return (error as {name?:string})?.name==='InvalidStateError'?(gl.xr.getFrame()??undefined):undefined;}
}

/** One trigger or pinch, never shared across presses. Re-pick with the
 * physical source on the frame that can debit stock, not a cached hover. */
export function milkRayGuard(gl:WebGLRenderer,session:XRSession,source:XRInputSource,target:Mesh){
  const sample=xrPoseSampler(),caster=new Raycaster();let hadPosition=false;
  return (frame?:XRFrame)=>{
    if(!frame||gl.xr.getSession()!==session||useHudWorldInput.getState().blocked)return false;
    const ref=gl.xr.getReferenceSpace(),pose=sample(source,session,frame,ref,gl.xr.getCamera().parent);
    if(!pose||!ref)return false;
    let emulated=pose.emulated;
    if(source.hand){
      const tip=source.hand.get('index-finger-tip'),thumb=source.hand.get('thumb-tip');
      try{
        const indexPose=tip&&frame.getJointPose?.(tip,ref),thumbPose=thumb&&frame.getJointPose?.(thumb,ref);
        if(!indexPose||!thumbPose)return false;
        emulated||=!!(indexPose.emulatedPosition||thumbPose.emulatedPosition);
      }catch{return false;}
    }
    // Rotational controllers may report emulatedPosition for their entire
    // lifetime. A tracked → emulated transition during a press is a loss.
    if(hadPosition&&emulated)return false;
    hadPosition||=!emulated;
    target.updateWorldMatrix(true,false);caster.ray.copy(pose.ray);
    return caster.intersectObject(target,false).length>0;
  };
}
