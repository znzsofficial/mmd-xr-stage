import handCode from './handSupport.wgsl?raw';
import collisionCode from './contact.wgsl?raw';
import {gripMotion} from './handMotion.js';

// The solver and the draw consume the same point buffer. A dispatch boundary
// separates parallel reads of that buffer from node writes (no float atomics).
export async function makeHandPass({device,rig,fitted,buf,shader,bind,palette,points,goals,history,caps,bounds,headers}){
  const count=fitted.faces.length,motion=gripMotion();
  if(!count)return {count,observe(){},reset(){},begin:()=>false};
  const m=await shader(collisionCode+handCode,'原衣双手承托');
  const pipe=entryPoint=>device.createComputePipelineAsync({layout:'auto',compute:{module:m,entryPoint}});
  const [sample,lift]=await Promise.all([pipe('handSamples'),pipe('liftNodes')]);
  const storage=(name,data)=>buf(name,data,GPUBufferUsage.STORAGE);
  const responses=storage('hand face responses',new Float32Array(8*count));
  const skin=[[1,storage('hand sample spans',fitted.heads)],[2,storage('hand sample weights',fitted.terms)],[3,palette],[4,goals],[5,points],[6,history],[9,responses]];
  const gather=bind(lift.getBindGroupLayout(0),[[5,points],[6,history],[7,caps],[8,bounds],[9,responses],[10,storage('hand node spans',fitted.ranges)],[11,storage('hand node weights',fitted.refs)],[12,headers]]);
  const frames=[];
  function begin(steps,seed){
    if(!motion.active)return false;
    for(let i=0;i<steps;i++){
      // The lab submits at most three substeps. Bind an immutable slice of
      // motion to each: successive queue writes to ONE uniform wouldn't work.
      if(!frames[i]){const data=new Float32Array(20);data[16]=rig.scale;const ubo=buf('grip sweep',data,GPUBufferUsage.UNIFORM);
        frames[i]={data,ubo,group:bind(sample.getBindGroupLayout(0),[[0,ubo],...skin])};}
      const {data,ubo}=frames[i];motion.write(data,i,steps,seed);device.queue.writeBuffer(ubo,0,data);
    }
    motion.commit();return true;
  }
  function run(pass,step){pass.setPipeline(sample);pass.setBindGroup(0,frames[step].group);pass.dispatchWorkgroups(Math.ceil(count/64));
    pass.setPipeline(lift);pass.setBindGroup(0,gather);pass.dispatchWorkgroups(Math.ceil(rig.nodes.length/64));}
  return {count,observe:motion.observe,reset:motion.reset,begin,run};
}
