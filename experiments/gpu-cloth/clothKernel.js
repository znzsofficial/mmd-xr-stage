import solveCode from './cloth.wgsl?raw';
import collisionCode from './contact.wgsl?raw';
import {checkedShader,clothProgram} from './clothPrograms.js';
import {BOX_FLOATS,writeBounds} from './contactBounds.js';
import {makeHandPass,prepareHandPipelines} from './handPass.js';
import {contactPacket} from './rig.js';

export const CLOTH_DT=1/72;
const solverSource=collisionCode+solveCode;

// Only objects created through this arena are destroyed. In particular the
// room's points and goals belong to the Three surface, not the compute kernel.
export function gpuResources(d){
  const owned=[],own=x=>(owned.push(x),x);
  const buf=(name,data,usage)=>{const size=Math.max(4,Math.ceil(data.byteLength/4)*4),b=own(d.createBuffer({label:name,size,usage:usage|GPUBufferUsage.COPY_DST}));
    // An authored Uint16 index buffer can end after an odd number of triangles.
    if(data.byteLength%4){const padded=new Uint8Array(size);padded.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));d.queue.writeBuffer(b,0,padded);}
    else if(data.byteLength)d.queue.writeBuffer(b,0,data);return b;};
  const bind=(layout,pairs)=>d.createBindGroup({layout,entries:pairs.map(([binding,buffer])=>({binding,resource:{buffer}}))});
  const shader=(code,label)=>checkedShader(d,code,label);
  return {buf,bind,shader,own,dispose(){for(const b of owned.splice(0))b.destroy();}};
}

async function prepareSolverPipelines(d){
  const solver=await clothProgram(d,solverSource,'裙摆求解');
  const [predict,relax]=await Promise.all([solver.pipeline('predict'),solver.pipeline('constrain')]);
  return {module:solver.module,predict,relax};
}

export async function prepareClothPipelines(device,handSamples){
  const [solver,hands]=await Promise.all([
    prepareSolverPipelines(device),
    handSamples.faces.length?prepareHandPipelines(device):null,
  ]);
  return {solver,hands};
}

// One authored rig, one solver. The caller supplies its own command pass,
// completed surface fit, skin palette and output pair. No draw or submission.
export function makeClothKernel(d,rig,{buf,bind},{points,goals,palette,handSamples},{solver,hands}){
  const {predict,relax}=solver;
  const S=GPUBufferUsage.STORAGE,U=GPUBufferUsage.UNIFORM,n=rig.nodes.length,groups=Math.ceil(n/64);
  const point=[points,buf('solver scratch',rig.rest,S)],history=buf('previous',new Float32Array(n*8),S);
  const meta=buf('connections',rig.headers,S),edges=buf('edges',rig.links,S),caps=new Float32Array((rig.capsules.length+2)*8),cap=buf('capsules',caps,S);
  const params=[0,1].map(seed=>{const a=new ArrayBuffer(16);new Float32Array(a)[0]=CLOTH_DT;new Uint32Array(a).set([seed,caps.length/8,n],1);return buf('step',new Uint32Array(a),U);});
  const pre=params.map(f=>bind(predict.getBindGroupLayout(0),[[0,f],[1,goals],[2,point[0]],[3,point[1]],[4,history]]));
  const boxes=new Float32Array(BOX_FLOATS),box=buf('contact bounds',boxes,U);
  const relaxGroups=(pipe,extra=[])=>[0,1].map(i=>bind(pipe.getBindGroupLayout(0),[[0,params[0]],[1,goals],[2,point[i]],[3,point[1-i]],[5,meta],[6,edges],[7,cap],[8,box],...extra]));
  const rgroup=relaxGroups(relax);
  const support=makeHandPass({device:d,rig,fitted:handSamples,buf,bind,palette,points,goals,history,caps:cap,bounds:box,headers:meta},hands);

  function contacts(hands,active,worldToMesh,handMetric=1){
    contactPacket(rig,hands,caps,worldToMesh,handMetric);d.queue.writeBuffer(cap,0,caps);
    if(active){writeBounds(caps,boxes);d.queue.writeBuffer(box,0,boxes);}
  }
  function run(pass,steps,seed,override){
    const handStep=support.begin(steps,seed);
    for(let i=0;i<steps;i++){
      pass.setPipeline(predict);pass.setBindGroup(0,pre[Number(seed&&i===0)]);pass.dispatchWorkgroups(groups);
      // predict: output -> scratch; five Jacobi dispatches end in output.
      pass.setPipeline(override?.pipe??relax);
      for(let k=0;k<5;k++){pass.setBindGroup(0,(override?.groups??rgroup)[1-k%2]);pass.dispatchWorkgroups(groups);}
      if(handStep)support.run(pass,i);
    }
  }
  return {contacts,run,support,cap,box,meta,solver:solver.module,relaxGroups};
}
