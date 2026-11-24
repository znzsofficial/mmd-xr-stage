import * as THREE from "three";

const dragMin=new THREE.Vector3(-1.8,.65,-5),dragMax=new THREE.Vector3(1.8,2.25,-.5);
export function clampMmdVrHudPosition(p:THREE.Vector3):[number,number,number] {return p.clone().clamp(dragMin,dragMax).toArray();}

/** The common panel is directly beneath XROrigin: the tracked viewer pose
 * already uses the local axes, including on a tilted planet. */
export function hudEye(out:THREE.Vector3,parent:THREE.Object3D,camera:THREE.Camera,xr:THREE.WebXRManager,frame?:XRFrame){
  const space=frame&&xr.getReferenceSpace();
  if(frame&&space){const view=frame.getViewerPose(space);if(!view)return false;out.copy(view.transform.position);}
  else parent.worldToLocal(camera.getWorldPosition(out));
  return true;
}

export function faceHud(panel:THREE.Object3D,eye:THREE.Vector3){
  const x=eye.x-panel.position.x,z=eye.z-panel.position.z;
  if(x*x+z*z>=1e-8)panel.rotation.y=Math.atan2(x,z);
}

/** Rotate about the picked point, not the centre of the title. In panel axes
 * the eye has X=0, so the lateral component of (eye - hit) must be -grip.x. */
export function dragHud(panel:THREE.Object3D,hit:THREE.Vector3,grip:THREE.Vector3,eye:THREE.Vector3,follow:boolean){
  let yaw=panel.rotation.y;
  if(follow){const x=eye.x-hit.x,z=eye.z-hit.z,r=Math.hypot(x,z);
    if(r>Math.abs(grip.x)+1e-5)yaw=Math.atan2(x,z)+Math.asin(grip.x/r);}
  const c=Math.cos(yaw),s=Math.sin(yaw);
  panel.position.set(hit.x-c*grip.x-s*grip.z,hit.y-grip.y,hit.z+s*grip.x-c*grip.z);
  panel.position.clamp(dragMin,dragMax);
  // At a travel limit, face the actual (bounded) centre. Release then uses
  // exactly the same orientation as the final held frame.
  if(follow)faceHud(panel,eye);
}

export function placeHudInFront(camera: THREE.Camera, parent: THREE.Object3D, panel: THREE.Object3D) {
  const eye = parent.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
  const forward = camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();
  const target = eye.clone().addScaledVector(forward, 1.8);
  target.y -= 0.12;
  panel.position.copy(target);
  panel.rotation.set(0, Math.atan2(eye.x - panel.position.x, eye.z - panel.position.z), 0);
}
