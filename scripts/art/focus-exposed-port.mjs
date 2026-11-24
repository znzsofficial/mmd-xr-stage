// Local Vite *screen stage* with a selected actor, paused pose and an already
// visible, calibrated attachment. Run the same script in the baseline and new
// checkout. It never reveals or replaces a mesh, moves the player, changes a
// light, or creates a renderer. Save returned PNGs in ignored review storage.
//   const frames=await page.evaluate(async()=>
//     (await import('/scripts/art/focus-exposed-port.mjs')).captureExposedPort());
//   // each frame: {degrees,png (base64),geometry,roughnessMap,exposure,draws}
import {_roots} from '@react-three/fiber';
import {Box3,Vector3} from 'three';
import {useBackpack} from '/src/mmdVrShowcase/backpack/store.ts';
import {canDrawAdapter,usePelvic} from '/src/mmdVrShowcase/pelvic/store.ts';
import {useMmdVrStore} from '/src/mmdVrShowcase/mmdVrStore.ts';

export function captureExposedPort(angles=[-38,0,38,82]){
  const bag=useBackpack.getState(),id=bag.selected,actor=id&&bag.live[id],state=usePelvic.getState(),fit=state.byAsset[id],support=state.support[id];
  const product=useMmdVrStore.getState();
  if(!actor?.visible||!fit||support?.runtimeId!==actor.runtimeId||!canDrawAdapter(fit,support))
    throw Error('Select the existing exposed, calibrated stage attachment; a diagram or calibration guide is not the shell.');
  if(product.playing||product.presentation!=='screen'||document.hidden)throw Error('Pause playback on the visible screen stage.');
  const match=[..._roots.values()].map(root=>root.store.getState()).find(r=>r.scene.getObjectByName(`pelvic:adapter:${id}`));
  const shell=match?.scene.getObjectByName(`pelvic:adapter:${id}`)?.getObjectByName('pelvic:seal');
  if(!shell?.isMesh||!shell.material.visible)throw Error('No mounted shell material.');
  for(let p=shell;p;p=p.parent)if(!p.visible)throw Error('Attachment is hidden by the stage.');
  const {gl,scene,camera}=match;if(gl.xr.isPresenting||!camera.isPerspectiveCamera||gl.getRenderTarget())throw Error('Use the existing perspective screen renderer at the default framebuffer.');
  shell.updateWorldMatrix(true,false);
  const pos=shell.geometry.getAttribute('position'),box=new Box3().setFromBufferAttribute(pos),centre=box.getCenter(new Vector3()),ext=box.getSize(new Vector3());
  const image=gl.domElement,size=Math.min(image.width,image.height),cam=camera.clone(false),halfHeight=Math.max(ext.y,ext.x,ext.z)*.60;
  if(!(size>0&&Number.isFinite(halfHeight)&&halfHeight>0))throw Error('No fitted triangles or view.');
  cam.aspect=image.width/image.height;cam.fov=34;cam.zoom=1;cam.clearViewOffset();
  const distance=halfHeight*image.height/size/Math.tan(cam.fov*Math.PI/360)+ext.z*.30;
  const scale=shell.getWorldScale(new Vector3()).length()/Math.sqrt(3);cam.near=Math.min(cam.near,distance*scale*.025);cam.updateProjectionMatrix();
  const target=shell.localToWorld(centre.clone());cam.up.set(0,1,0).transformDirection(shell.matrixWorld);
  const crop=document.createElement('canvas');crop.width=crop.height=Math.min(size,624);const ink=crop.getContext('2d');
  const geom={vertices:pos.count,triangles:shell.geometry.index.count/3,localBounds:[...box.min.toArray(),...box.max.toArray()]};
  const bytes=new Uint8Array(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength);let fingerprint=2166136261;for(const b of bytes)fingerprint=Math.imul(fingerprint^b,16777619);geom.positionSignature=(fingerprint>>>0).toString(16);
  const map=shell.material.roughnessMap?.image,cb=shell.onAfterRender;let draws=0;
  shell.onAfterRender=function(...args){if(args[2]===cam)draws++;cb.apply(this,args);};
  try{return angles.map(degrees=>{
    if(!Number.isFinite(degrees))throw Error('Non-finite angle');
    const a=degrees*Math.PI/180;cam.position.copy(centre).add(new Vector3(-Math.sin(a),0,Math.cos(a)).multiplyScalar(distance));shell.localToWorld(cam.position);
    cam.lookAt(target);cam.updateMatrixWorld();draws=0;gl.render(scene,cam);
    if(!draws)throw Error('Renderer did not submit the exposed attachment.');
    ink.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,crop.width,crop.height);
    return {degrees,png:crop.toDataURL('image/png').split(',')[1],geometry:geom,roughnessMap:map?[map.width,map.height]:null,exposure:gl.toneMappingExposure,draws};
  });}finally{shell.onAfterRender=cb;gl.render(scene,camera);}
}
