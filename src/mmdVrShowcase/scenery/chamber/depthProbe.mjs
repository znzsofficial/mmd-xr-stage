// Screen-only maintenance probe. Not imported by the product. See medieval-chamber.md.
const views={
  portal:[[.64,1.65,-.94],[-.42,1.65,-2.04]], reverse:[[.69,1.64,-3.1],[1.63,1.99,-2.04]],
  wheelRear:[[-3.16,1.48,-3.4],[-2.65,1.14,-3.39]], gallery:[[.92,1.54,-4.05],[-2.69,1.03,-4.46]],
  cabinet:[[1.31,1.51,-5.14],[2.72,1.12,-6.39]], back:[[3.02,1.64,-7.18],[2.72,1.25,-6.39]],
  west:[[-1.48,1.61,2.28],[-9.4,1.90,2.18]], archWindow:[[1.68,1.6,-5.6],[1.99,2.45,-7.45]],
  vault:[[.45,1.65,.04],[-1.62,3.57,.86]], floor:[[.45,1.65,-3.39],[-.54,0,-5.74]],
  archive:[[1.84,1.42,2.04],[2.99,.84,1.16]], entry:[[.91,1.58,3.68],[-.47,1.30,-1.12]],
};
function changed(a,b){
  let n=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>=4)n++;
  return n;
}
export async function measureChamber({gl:renderer,scene,camera},{near=camera.near,far=camera.far}={}){
  const room=scene.getObjectByName('scenery:medievalChamber');
  if(!room||renderer.xr.isPresenting)throw Error('Open the chamber in screen viewing first.');
  const parts=room.children.filter(o=>o.isMesh).map(o=>{
    const saved=o.geometry.index.array.slice(),reverse=saved.slice(),N=saved.length;
    for(let i=0;i<N;i+=3)reverse.set(saved.subarray(N-3-i,N-i),i);
    return {o,saved,reverse,order:o.renderOrder};
  });
  const cam=camera.clone(),gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  cam.near=near;cam.far=far;cam.updateProjectionMatrix();
  const normal=new Uint8Array(w*h*4),reverse=new Uint8Array(normal.length),jitter=new Uint8Array(normal.length);
  function order(which){
    parts.forEach(({o,saved,reverse,order},i)=>{o.geometry.index.array.set(which==='reverse'?reverse:saved);o.geometry.index.needsUpdate=true;
      o.renderOrder=which==='normal'?order:which==='reverse'?parts.length-i:i;});
  }
  function frame(eye,aim,x,pixels){
    cam.position.set(...eye);cam.position.x+=x;cam.lookAt(...aim);cam.updateMatrixWorld();renderer.render(scene,cam);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  }
  const samples=[];
  try{for(const [name,[eye,aim]] of Object.entries(views)){
    const ties=[],motion=[];
    for(const x of [-.08,-.04,0,.04,.08]){
      await new Promise(requestAnimationFrame);
      order('normal');frame(eye,aim,x,normal);frame(eye,aim,x+.00025,jitter);motion.push(changed(normal,jitter));
      order('forward');frame(eye,aim,x,normal);order('reverse');frame(eye,aim,x,reverse);ties.push(changed(normal,reverse));
    }
    samples.push({name,ties,motion});
  }}finally{order('normal');renderer.render(scene,camera);}
  const shaders=renderer.info.programs.flatMap(p=>gl.getAttachedShaders(p.program));
  return {size:[w,h],near,far,depthBits:gl.getParameter(gl.DEPTH_BITS),shaders:shaders.length,
    failed:shaders.filter(s=>!gl.getShaderParameter(s,gl.COMPILE_STATUS)).length,samples};
}

export async function probeChamber(options){
  // The root already mounted by Vite owns the renderer; don't construct a separate scene.
  const {_roots}=await import('@react-three/fiber');
  return measureChamber(_roots.get(document.querySelector('dialog canvas')).store.getState(),options);
}
