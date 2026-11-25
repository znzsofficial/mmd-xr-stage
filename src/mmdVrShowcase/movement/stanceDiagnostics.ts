import {Quaternion,Vector3,type Scene,type WebGLRenderer} from 'three';
import type {MovementMode} from '../settings/preferences';

// Only a matching visible frame may publish a sample. Keep coordinates local
// to this visit; the export contains lengths and angles, never room bounds.
export function stanceProbe(){return {frame:undefined as XRFrame|undefined,mode:'normal' as MovementMode,grounded:false,
  foot:new Vector3(),up:new Vector3(0,1,0),navUp:new Vector3(0,1,0),centre:null as Vector3|null,clearance:null as ((p:Vector3)=>number)|null,
  wanted:0,lift:0,returns:0,cancelDraw:undefined as (()=>void)|undefined};}
type Probe=ReturnType<typeof stanceProbe>;
let active:Probe|undefined;
export function observeStance(probe:Probe){active?.cancelDraw?.();active=probe;return()=>{probe.cancelDraw?.();probe.frame=undefined;if(active===probe)active=undefined;};}

const up=new Vector3(0,1,0),eye=new Vector3(),axis=new Vector3(),local=new Vector3(),eyeUp=new Vector3();
const rot=new Quaternion(),tracking=new Quaternion(),inverse=new Quaternion();
const metres=(x:number)=>Math.round(x*1000)/1000,deg=(x:number)=>Math.round(x*180/Math.PI*100)/100;
function roll(q:Quaternion,vertical:Vector3){local.copy(vertical).applyQuaternion(inverse.copy(q).invert());
  return Math.hypot(local.x,local.y)<.01?null:deg(Math.atan2(local.x,local.y));}

// Called at the recorder's cadence, after movement but BEFORE Three draws.
// Read the actual submitted eye matrices after render: multiplying the planned
// origin by the input pose here would hide a missing/incorrect camera parent.
export function samplePlayerStance(frame:XRFrame,gl:WebGLRenderer,scene:Scene){
  const s=active;if(!s||s.frame!==frame)return;
  const space=gl.xr.getReferenceSpace(),pose=space&&frame.getViewerPose(space);if(!pose)return;
  const sample={mode:s.mode,grounded:s.grounded,normalReturns:s.returns,trackedEyeM:metres(pose.transform.position.y),
    requestedOffsetM:s.wanted,appliedOffsetM:metres(s.lift),navTiltDeg:deg(s.navUp.angleTo(s.up)),
    drawn:null as null|{eyes:number;eyeAboveFootM:number;shellClearanceM:number|null;rigTiltDeg:number;viewRollDeg:number|null;trackedRollDeg:number|null}};
  s.cancelDraw?.();const before=scene.onAfterRender;
  function cancel(){if(scene.onAfterRender===after)scene.onAfterRender=before;if(s?.cancelDraw===cancel)s.cancelDraw=undefined;}
  const after:Scene['onAfterRender']=function(...args){
    before.apply(scene,args);const [renderer,drawScene,camera]=args;
    if(renderer!==gl||scene!==drawScene||s.cancelDraw!==cancel)return; // another renderer cannot consume this frame's receipt
    if(active!==s||s.frame!==frame||gl.xr.getFrame()!==frame){cancel();return;}
    const xrCamera=gl.xr.getCamera();if(camera!==xrCamera)return;
    cancel();const cameras=xrCamera.cameras;if(!cameras.length||cameras.length!==pose.views.length)return;
    eye.set(0,0,0);for(const camera of cameras)eye.add(axis.setFromMatrixPosition(camera.matrixWorld));eye.divideScalar(cameras.length);
    const shellClearanceM=s.clearance?metres(s.clearance(eye)):null;
    // The local horizon in the lenses is at the visitor, not at an old
    // navigation sole that may still be on the other side of a physical lean.
    if(s.centre)eyeUp.subVectors(eye,s.centre).normalize();else eyeUp.copy(s.up);
    // XRView can be canted; remove that same eye's own tracking orientation.
    const view=pose.views[0].transform.orientation;tracking.set(view.x,view.y,view.z,view.w);
    const trackedRollDeg=roll(tracking,up);rot.setFromRotationMatrix(cameras[0].matrixWorld).normalize();
    const viewRollDeg=roll(rot,eyeUp);rot.multiply(tracking.invert());
    sample.drawn={eyes:cameras.length,eyeAboveFootM:metres(eye.sub(s.foot).dot(s.up)),shellClearanceM,
      rigTiltDeg:deg(axis.copy(up).applyQuaternion(rot).angleTo(eyeUp)),viewRollDeg,trackedRollDeg};
  };s.cancelDraw=cancel;scene.onAfterRender=after;return sample;
}
