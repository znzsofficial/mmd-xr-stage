import {Matrix4,Vector3} from 'three';
import {CLOTH_DT,gpuResources,makeClothKernel} from '../../experiments/gpu-cloth/clothKernel.js';

/** Before adapter.attach(model): fitRig(mesh), then rig.handSamples = makeHandSamples(mesh, rig).
 * The surface and this driver share that rig. Both GPUBuffer outputs are borrowed vec4[n].
 * After pose evaluation call step once per frame before drawing (never once per eye).
 * Reset invalidates history; the next step reseeds in its own frame, even when dt is zero.
 */
export async function createClothDriver(renderer,model,rig,{points,goals},signal){
  const device=renderer.backend.device,mesh=model.mesh,{bones,boneInverses}=mesh.skeleton;
  if(!rig.handSamples)throw Error('Pass rig.handSamples fitted on the original PMX before TSL attach');
  const S=GPUBufferUsage.STORAGE,size=rig.rest.byteLength;
  if(points===goals||points?.size!==size||goals?.size!==size||!(points.usage&S)||!(goals.usage&S)||!(goals.usage&GPUBufferUsage.COPY_DST)){
    throw Error('Cloth requires distinct vec4[n] STORAGE buffers; goals also needs COPY_DST');
  }
  const resources=gpuResources(device), release=()=>{signal?.removeEventListener('abort',release);resources.dispose();};
  signal?.throwIfAborted();signal?.addEventListener('abort',release,{once:true});
  try{
    const palette=new Float32Array(bones.length*16),pal=resources.buf('hand surface skin palette',palette,S);
    // A compile may outlive put-away. Never allocate or bind borrowed surface
    // buffers on its continuation after the synchronous actor teardown.
    const guard=fn=>(...args)=>{signal?.throwIfAborted();return fn(...args);};
    const shader=async(...args)=>{signal?.throwIfAborted();const m=await resources.shader(...args);signal?.throwIfAborted();return m;};
    const kernel=await makeClothKernel(device,rig,{buf:guard(resources.buf),bind:guard(resources.bind),shader},
      {points,goals,palette:pal,handSamples:rig.handSamples});
    signal?.throwIfAborted();
    const targets=rig.rest.slice(),worldToMesh=new Matrix4(),skin=new Matrix4(),p=new Vector3();
    const palms=[new Vector3(),new Vector3()],local=[null,null];
    // The PMX has an attached skeleton. Its boneMatrices are boneWorld * inverseBindBone,
    // i.e. they include the placed mesh's transform. Build only the sampled matrices as
    // worldToMesh * boneWorld * inverseBindBone * bindMesh. Never edit Three's palette.
    const sampled=new Map(),terms=rig.handSamples.terms;
    for(let i=4;i<terms.length;i+=8){const b=terms[i];if(!sampled.has(b))sampled.set(b,boneInverses[b].clone().multiply(mesh.bindMatrix));}

    let credit=0,seed=true,disposed=false;
    function reset(){credit=0;seed=true;kernel.support.reset();}
    function step(dtSeconds,worldPalms){
      if(disposed)return 0;
      if(!Number.isFinite(dtSeconds)||dtSeconds<0||dtSeconds>.25)reset();
      let steps=1;
      if(!seed){credit+=Math.min(.05,dtSeconds);steps=Math.min(3,Math.floor(credit/CLOTH_DT+1e-6));credit=Math.min(CLOTH_DT,Math.max(0,credit-steps*CLOTH_DT));}

      mesh.updateWorldMatrix(true,true);
      worldToMesh.copy(mesh.matrixWorld).invert();
      // Room actors use a uniform placement scale. Keep the physical palm radius
      // and sweep discontinuity in metres while the solver runs at .1 per PMX unit.
      const e=mesh.matrixWorld.elements,handMetric=rig.scale/Math.hypot(e[0],e[1],e[2]);
      for(let side=0;side<2;side++){
        const hand=worldPalms?.[side];local[side]=hand?palms[side].copy(hand).applyMatrix4(worldToMesh).multiplyScalar(rig.scale):null;
      }
      kernel.support.observe(local,handMetric);
      // Observe a loss even without a tick. Publish the (points,goals) pair only
      // on a solve, so faster display frames don't see stale points minus new goals.
      if(!steps)return 0;
      for(let i=0;i<rig.nodes.length;i++)p.setFromMatrixPosition(bones[rig.nodes[i].bone].matrixWorld)
        .applyMatrix4(worldToMesh).multiplyScalar(rig.scale).toArray(targets,i*4);
      device.queue.writeBuffer(goals,0,targets);
      if((local[0]||local[1])&&sampled.size){
        for(const [b,fromBind] of sampled)skin.multiplyMatrices(worldToMesh,bones[b].matrixWorld).multiply(fromBind).toArray(palette,b*16);
        device.queue.writeBuffer(pal,0,palette);
      }
      kernel.contacts(local,true,worldToMesh,handMetric);
      const encoder=device.createCommandEncoder({label:'PMX cloth step'}),pass=encoder.beginComputePass();
      kernel.run(pass,steps,seed);pass.end();device.queue.submit([encoder.finish()]);
      seed=false;return steps;
    }
    return {step,reset,dispose(){if(!disposed){disposed=true;release();}}};
  }catch(error){release();throw error;}
}
