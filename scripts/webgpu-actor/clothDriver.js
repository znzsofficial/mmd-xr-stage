import {Matrix4,Vector3} from 'three';
import {CLOTH_DT,gpuResources,makeClothKernel,prepareClothPipelines} from '../../experiments/gpu-cloth/clothKernel.js';

// Only the hand shader uses these palette indices. Keep the authored terms and
// their cloth-node indices intact for the other consumers of the fitted rig.
function prepareHandPalette(mesh,handSamples){
  const terms=handSamples.terms.slice(),slots=new Map(),entries=[];
  for(let i=4;i<terms.length;i+=8){
    const bone=terms[i];
    let slot=slots.get(bone);
    if(slot===undefined){
      slot=entries.length;
      slots.set(bone,slot);
      entries.push({bone,fromBind:mesh.skeleton.boneInverses[bone].clone().multiply(mesh.bindMatrix)});
    }
    terms[i]=slot;
  }
  return {entries,handSamples:{...handSamples,terms}};
}

/** Before adapter.attach(model): fitRig(mesh), then rig.handSamples = makeHandSamples(mesh, rig).
 * The surface and this driver share that rig. Both GPUBuffer outputs are borrowed vec4[n].
 * After pose evaluation call step once per frame before drawing (never once per eye).
 * Reset invalidates history; the next step reseeds in its own frame, even when dt is zero.
 */
export async function createClothDriver(renderer,model,rig,{points,goals},signal,gpuTiming){
  const device=renderer.backend.device,mesh=model.mesh,{bones}=mesh.skeleton;
  if(!rig.handSamples)throw Error('Pass rig.handSamples fitted on the original PMX before TSL attach');
  const S=GPUBufferUsage.STORAGE,size=rig.rest.byteLength;
  if(points===goals||points?.size!==size||goals?.size!==size||!(points.usage&S)||!(goals.usage&S)||!(goals.usage&GPUBufferUsage.COPY_DST)){
    throw Error('Cloth requires distinct vec4[n] STORAGE buffers; goals also needs COPY_DST');
  }
  const resources=gpuResources(device), release=()=>{signal?.removeEventListener('abort',release);resources.dispose();};
  signal?.throwIfAborted();signal?.addEventListener('abort',release,{once:true});
  try{
    // Shared compilation may outlive put-away. Check before allocating or
    // binding any actor resources on its continuation.
    const pipelines=await prepareClothPipelines(device,rig.handSamples);
    signal?.throwIfAborted();
    const {entries,handSamples}=prepareHandPalette(mesh,rig.handSamples);
    const palette=new Float32Array(entries.length*16);
    const pal=handSamples.faces.length?resources.buf('hand surface skin palette',palette,S):null;
    const guard=fn=>(...args)=>{signal?.throwIfAborted();return fn(...args);};
    const kernel=makeClothKernel(device,rig,{buf:guard(resources.buf),bind:guard(resources.bind)},
      {points,goals,palette:pal,handSamples},pipelines);
    const targets=rig.rest.slice(),worldToMesh=new Matrix4(),skin=new Matrix4(),p=new Vector3();
    const palms=[new Vector3(),new Vector3()],local=[null,null];

    let credit=0,seed=true,disposed=false;
    function reset(){credit=0;seed=true;kernel.support.reset();}
    function step(dtSeconds,worldPalms){
      if(disposed)return 0;
      if(!Number.isFinite(dtSeconds)||dtSeconds<0||dtSeconds>.25)reset();
      let steps=1;
      if(!seed){credit+=Math.min(.05,dtSeconds);steps=Math.min(3,Math.floor(credit/CLOTH_DT+1e-6));credit=Math.min(CLOTH_DT,Math.max(0,credit-steps*CLOTH_DT));}

      if(!steps&&!worldPalms?.[0]&&!worldPalms?.[1]){
        kernel.support.observe(worldPalms); // both sweeps lost; no coordinate conversion needed
        return 0;
      }
      // Only a solve reads descendants (goals, body proxies, sampled bones).
      // Between ticks the mesh and its parents still place the tracked palms.
      mesh.updateWorldMatrix(true,steps>0);
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
      if((local[0]||local[1])&&pal&&entries.length){
        // Attached PMX: remove the live placement from each sampled bone.
        // One contiguous write, even for scattered author IDs or a dense rig.
        for(let slot=0;slot<entries.length;slot++){
          const {bone,fromBind}=entries[slot];
          skin.multiplyMatrices(worldToMesh,bones[bone].matrixWorld).multiply(fromBind).toArray(palette,slot*16);
        }
        device.queue.writeBuffer(pal,0,palette);
      }
      kernel.contacts(local,true,worldToMesh,handMetric);
      const encoder=device.createCommandEncoder({label:'PMX cloth step'}),pass=encoder.beginComputePass(gpuTiming?.clothPass(steps));
      kernel.run(pass,steps,seed);pass.end();device.queue.submit([encoder.finish()]);
      seed=false;return steps;
    }
    return {step,reset,dispose(){if(!disposed){disposed=true;release();}}};
  }catch(error){release();throw error;}
}
