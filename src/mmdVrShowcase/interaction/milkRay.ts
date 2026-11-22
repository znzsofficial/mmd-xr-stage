import {Raycaster,type Mesh,type WebGLRenderer} from 'three';
import {useHudWorldInput} from '../components/hudWorldInput';
import {xrPoseSampler} from '../pose/xrPoseSample';

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
      const indexPose=tip&&frame.getJointPose?.(tip,ref),thumbPose=thumb&&frame.getJointPose?.(thumb,ref);
      if(!indexPose||!thumbPose)return false;
      emulated=!!(indexPose.emulatedPosition||thumbPose.emulatedPosition);
    }
    // Rotational controllers may report emulatedPosition for their entire
    // lifetime. A tracked → emulated transition during a press is a loss.
    if(hadPosition&&emulated)return false;
    hadPosition||=!emulated;
    target.updateWorldMatrix(true,false);caster.ray.copy(pose.ray);
    return caster.intersectObject(target,false).length>0;
  };
}
