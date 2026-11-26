import {WebGPURenderer} from 'three/webgpu';

// The qualification page can open many *sessions*, but needs just one healthy
// XR-compatible renderer/device. Only the idle renderer crosses that boundary.
// Each session still creates a new root, store, projection layer and actors.
let idle;
function forget(){
  const r=idle;idle=undefined;window.removeEventListener('pagehide',forget);
  if(r)void r.dispose().catch(()=>{});
}
export function takeFloorRenderer(){
  const renderer=idle??new WebGPURenderer({antialias:false});
  idle=undefined;window.removeEventListener('pagehide',forget);
  return renderer;
}
export async function returnFloorRenderer(renderer,reusable){
  if(!reusable || !renderer.hasInitialized() || !renderer.backend.isWebGPUBackend || renderer.xr.getSession()){
    await renderer.dispose();return;
  }
  // XRManager stops the session RAF but restores a window RAF and retains its
  // previous callback/reference space in r187. Park it without a live room or
  // a ticking renderer; setAnimationLoop(callback) starts it on the next entry.
  await renderer.setAnimationLoop(null);
  renderer._animation.stop();
  renderer.xr._currentAnimationLoop=null;
  renderer.xr._referenceSpace=null;
  renderer.xr._xrFrame=null;
  renderer.xr.setReferenceSpace(null);
  renderer.xr.getCamera().removeFromParent();
  renderer.onError=()=>{};
  renderer.onDeviceLost=()=>{if(idle===renderer)forget();};
  if(idle)forget();
  idle=renderer;window.addEventListener('pagehide',forget,{once:true});
}
