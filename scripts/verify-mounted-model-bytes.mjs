// CPU-only switch/rebind proof. Source read counts are the comparison; local
// File timing isn't a headset disk benchmark. No asset identifiers in output.
// node --expose-gc scripts/verify-mounted-model-bytes.mjs <model.pmx> <motion.vmd>
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerspectiveCamera,Scene,Vector3} from 'three';
import {loadNodeBulletStage} from './node-bullet-stage.mjs';

const [model,motion]=process.argv.slice(2);
if(!model||!motion)throw Error('Supply a local PMX and body VMD');
const {bullet,createMmdRuntimeHandle,close}=await loadNodeBulletStage();
const {createMountedModelBytePool,MODEL_BYTES_BUDGET}=await import('../src/mmdVrShowcase/mmdRuntime/mountedModelBytes.ts');
let reads=0,worlds=0,creates=0,peak=0,sourceBuffers=[];
class CountFile extends File {
  async arrayBuffer(){reads++;const bytes=await super.arrayBuffer();sourceBuffers.push(new WeakRef(bytes));return bytes;}
}
async function reachableBytes(){
  if(!global.gc)return null;
  for(let i=0;i<3;i++){await new Promise(ok=>setImmediate(ok));global.gc();}
  return sourceBuffers.reduce((n,ref)=>n+(ref.deref()?.byteLength??0),0);
}
const pmx=new CountFile([readFileSync(model)],'model.pmx'),vmd=new File([readFileSync(motion)],'body.vmd');
const create=bullet._mmd_anim_bullet_world_create,destroy=bullet._mmd_anim_bullet_world_destroy;
bullet._mmd_anim_bullet_world_create=(...args)=>{const code=create(...args);if(!code){creates++;peak=Math.max(peak,++worlds);}return code;};
bullet._mmd_anim_bullet_world_destroy=(...args)=>{worlds--;return destroy(...args);};
const camera=new PerspectiveCamera(),v=new Vector3(),rows=[],signatures=[];
try{
  for(const budget of [0,MODEL_BYTES_BUDGET]){
    assert.equal(worlds,0);reads=creates=peak=0;sourceBuffers=[];
    const pool=createMountedModelBytePool(budget), rowsForActor=[],signature=[];
    const rt=createMmdRuntimeHandle(new Scene(),{modelBytePool:pool});
    try{
      const {modelId:id}=await rt.addModel(pmx,[],{transform:{scale:.1}}),mesh=rt.getModelSurface(id).mesh;
      await rt.loadMotion(vmd,'body',id);assert.equal(reads,1);assert.equal(creates,0);
      rowsForActor.push({operation:'placement',reads,worlds});
      const source=Math.min(.5,rt.duration/2);
      for(const [i,on] of [true,false,true,false].entries()){
        const before=reads, work={};await rt.setPhysicsEnabled(on,work);
        const admitted=pmx.size<=budget,expected=(!on && !admitted)?1:0;
        assert.equal(reads-before,expected);assert.equal(worlds,+on);
        assert.equal(rt.getModelSurface(id).mesh,mesh);assert.equal(rt.exportProjectModels()[0].bodyMotionFile,vmd);
        for(let j=0;j<4;j++)rt.update(source+(i*4+j)/72,on,camera,1,false,1/72);
        for(const bone of mesh.skeleton.bones)signature.push(...bone.matrixWorld.elements);
        signature.push(...(mesh.morphTargetInfluences??[]));
        const count=mesh.geometry.attributes.position.count;
        for(let k=0;k<Math.min(count,64);k++){mesh.getVertexPosition(Math.floor(k*count/Math.min(count,64)),v);signature.push(v.x,v.y,v.z);}
        rowsForActor.push({operation:on?'enable':'disable',reads:reads-before,worlds,work});
      }
      const retained=pool.reservedBytes,gcMounted=await reachableBytes();rt.removeModel(id);assert.equal(pool.reservedBytes,0);
      const gcRemoved=await reachableBytes();if(global.gc){assert.equal(gcMounted,retained);assert.equal(gcRemoved,0);}
      rows.push({budget,retained,afterRemoval:pool.reservedBytes,gcMounted,gcRemoved,peakWorlds:peak,created:creates,rows:rowsForActor});signatures.push(signature);
    }finally{rt.dispose();}
  }
  assert.equal(worlds,0);assert(signatures[0].every(Number.isFinite));assert.deepEqual(signatures[0],signatures[1]);
  console.log(JSON.stringify({compared:signatures[0].length,rows},null,2));
}finally{close();}
