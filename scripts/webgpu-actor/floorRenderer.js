import {WebGPURenderer} from 'three/webgpu';

// The qualification page can open many *sessions*, but needs just one healthy
// XR-compatible renderer/device. Only the idle renderer crosses that boundary.
// Each session still creates a new root, store, projection layer and actors.
let idle;
function forget(){
  const r=idle;idle=undefined;window.removeEventListener('pagehide',forget);
  if(r)void r.dispose().catch(()=>{});
}
export async function takeFloorRenderer(antialias){
  const renderer=idle;
  idle=undefined;window.removeEventListener('pagehide',forget);
  if(renderer && (renderer.samples>1)===antialias)return renderer;
  if(renderer)await renderer.dispose(); // MSAA is chosen when this device/renderer is constructed.
  return new WebGPURenderer({antialias});
}

// r187's WebGPU path omits scaleFactor when it calls createProjectionLayer.
// Supply only the missing init member on THIS manager's initial binding call;
// Three still creates, owns, and retires the single layer and real binding.
export async function bindFloorSession(xr,session,scaleFactor){
  if(scaleFactor==null)return xr.setSession(session);
  const getBinding=xr.getWebGPUBinding;
  xr.getWebGPUBinding=function(){
    xr.getWebGPUBinding=getBinding;
    const binding=getBinding.call(xr);
    return {getPreferredColorFormat:()=>binding.getPreferredColorFormat(),
      createProjectionLayer:init=>binding.createProjectionLayer({...init,scaleFactor})};
  };
  try{return await xr.setSession(session);}finally{xr.getWebGPUBinding=getBinding;}
}

export function requestFloorDisplay(session,profile,requested){
  // Unsupported layers return null or omit fixedFoveation. Assigning to a
  // missing property would create an expando that then *looks* supported.
  const layer=session.renderState.layers?.[0];
  if(requested.foveation!==null && Number.isFinite(layer?.fixedFoveation)){
    try{layer.fixedFoveation=requested.foveation;}catch{/* optional device hint */}
  }
  const rates=Array.from(session.supportedFrameRates??[]).sort((a,b)=>a-b);
  if(!rates.length || !session.updateTargetFrameRate)return;
  const policy=profile.frameRate;
  const rate=typeof policy==='function'?policy(rates):policy && rates[Math.ceil((rates.length-1)*(policy==='high'?1:policy==='mid'?.5:0))];
  if(rate && rate!==session.frameRate){
    try{void session.updateTargetFrameRate(rate).catch(()=>{});}catch{/* actual Hz comes from XRSession */}
  }
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
