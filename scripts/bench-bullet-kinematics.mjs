// Node 26.12, CPU only. Supply a local PMX + body VMD. No network, renderer,
// asset names in the report, or change to Bullet's solver/collision settings.
// node scripts/bench-bullet-kinematics.mjs <model.pmx> <motion.vmd> [reverse]
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadNodeBulletStage} from './node-bullet-stage.mjs';
import {Matrix4, PerspectiveCamera, Scene, Vector3} from 'three';

const [pmxPath,vmdPath,reverse]=process.argv.slice(2);
if(!pmxPath||!vmdPath)throw Error('Supply a local PMX and body VMD');
const pmx=new File([readFileSync(pmxPath)],'model.pmx'),vmd=new File([readFileSync(vmdPath)],'body.vmd');
const code=(js)=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
function replaceOnce(source,needle,withText){assert.equal(source.split(needle).length,2);return source.replace(needle,withText);}
const backendURL=new URL('./mmdAnimBullet.js',import.meta.resolve('@yohawing/three-mmd-loader/physics'));
let candidate=readFileSync(backendURL,'utf8');
// Probe an exact-input cache only for mass-zero bodies. Never skip dynamic,
// reset or seek writes. copyDynamicOutputs uses scratchScale left by the last
// decompose, so reproduce that side effect even on an identical matrix.
candidate=replaceOnce(candidate,'this.targetTranslationUpdated = new Uint8Array(boneCount);',
  `this.targetTranslationUpdated = new Uint8Array(boneCount);
   this.priorStatic = bodies.map(b=>b.motionType==='static'?new Float64Array(19).fill(NaN):null);`);
candidate=replaceOnce(candidate,'this.scratchBone.fromArray(input, boneIndex * 16);',
  `const prior = this.priorStatic[i], base=boneIndex*16;
   if(prior && !includeDynamic){let j=0;while(j<16 && prior[j]===input[base+j])j++;
     if(j===16){this.scratchScale.fromArray(prior,16);continue;}}
   this.scratchBone.fromArray(input, boneIndex * 16);`);
candidate=replaceOnce(candidate,'this.module._mmd_anim_bullet_world_set_rigidbody_transform(this.world, i, this.transformPositionPointer, this.transformRotationPointer);',
  `const ok=this.module._mmd_anim_bullet_world_set_rigidbody_transform(this.world, i, this.transformPositionPointer, this.transformRotationPointer)===0;
   if(prior){if(ok){for(let j=0;j<16;j++)prior[j]=input[base+j];this.scratchScale.toArray(prior,16);}else prior.fill(NaN);}`);
const candidateUrl=code(candidate.replace('from "three"',`from ${JSON.stringify(import.meta.resolve('three'))}`));
const customURL=new URL('./customBulletMmd.js',backendURL);
const makeAlt=(await import(code(readFileSync(customURL,'utf8').replace('"./mmdAnimBullet.js"',JSON.stringify(candidateUrl))))).createCustomBulletMmdPhysicsBackend;
const {createCustomBulletMmdPhysicsBackend:makeBase}=await import('@yohawing/three-mmd-loader/physics');
const rows=[],order=reverse?[1,0]:[0,1],camera=new PerspectiveCamera(),park=new Matrix4().makeTranslation(0,-1000,0);
let building=null, timing=null;
const {bullet,createMmdRuntimeHandle,close}=await loadNodeBulletStage((module,opts)=>{
  const backend=(building.alt?makeAlt:makeBase)(module,opts);building.native=backend;return backend;
});
const set=bullet._mmd_anim_bullet_world_set_rigidbody_transform;
bullet._mmd_anim_bullet_world_set_rigidbody_transform=(...args)=>{if(timing)timing.writes++;return set(...args);};
const {handContactShape,handReferenceRadius}=await import('../src/mmdVrShowcase/xr/contact/handContactProfile.ts');
const controls=[park,park],hands=Array(12).fill(park),props=Array(8).fill(park);
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length,p95=a=>a.toSorted((a,b)=>a-b)[Math.ceil(.95*a.length)-1];
let boneSamples=0,vertexSamples=0,contactSamples=0,maxContacts=0;
try{
  for(const index of order){
    const row=rows[index]={alt:!!index,times:[],blocks:[],worldBlocks:[],feed:0,world:0,output:0,backend:0,writes:0,ticks:0};building=row;
    const rt=row.rt=createMmdRuntimeHandle(new Scene(),{
      controllerColliders:()=>controls,handColliders:()=>hands,handShape:handContactShape,handColliderRadius:()=>handReferenceRadius(.08),
      propColliders:()=>props,propShape:(_slot,r)=>({type:'sphere',size:[.03*r,0,0]}),
      onPhysicsPoseWork:(_a,_i,b)=>{if(timing)row.backend+=b;},
      onBulletStepWork:(feed,world,output,seed)=>{if(timing){assert(!seed);row.feed+=feed;row.world+=world;row.output+=output;row.ticks++;}}
    });
    const {modelId}=await rt.addModel(pmx,[],{physics:true,transform:{scale:.1}});await rt.loadMotion(vmd,'body',modelId);
    row.mesh=rt.getModelSurface(modelId).mesh;
  }
  const step=18,blocks=12,warm=4,va=new Vector3(),vb=new Vector3();assert(rows[0].rt.duration>(blocks+warm)*step/72);
  for(let block=-warm;block<blocks;block++){
    for(const k of block%2?order.toReversed():order){const r=rows[k];timing=block>=0?r:null;const before=r.world,chunk=[];
      for(let i=0;i<step;i++){
        const t=((block+warm)*step+i)/72,start=performance.now();r.rt.update(t,true,camera,1,false,1/72);
        if(timing)chunk.push(performance.now()-start);
      }
      if(timing){r.times.push(...chunk);r.blocks.push(avg(chunk));r.worldBlocks.push((r.world-before)/step);}timing=null;
    }
    const [a,b]=rows.map(r=>r.mesh);assert.equal(a.skeleton.bones.length,b.skeleton.bones.length);
    for(let i=0;i<a.skeleton.bones.length;i++){
      const aa=a.skeleton.bones[i].matrixWorld.elements,bb=b.skeleton.bones[i].matrixWorld.elements;
      assert(aa.every((v,j)=>Number.isFinite(v)&&v===bb[j]),'Bone trajectory changed');boneSamples+=16;
    }
    const count=a.geometry.attributes.position.count;
    for(let j=0;j<Math.min(64,count);j++){const i=Math.floor(j*count/Math.min(64,count));a.getVertexPosition(i,va);b.getVertexPosition(i,vb);assert(Number.isFinite(va.lengthSq())&&va.equals(vb));vertexSamples++;}
    const [ca,cb]=rows.map(r=>r.native.debugPhysicsContacts());assert.deepEqual(ca,cb);contactSamples++;maxContacts=Math.max(maxContacts,ca.length);
  }
  const fmt=n=>+n.toFixed(3);
  console.log(JSON.stringify({pmxBytes:pmx.size,vmdBytes:vmd.size,reverse:!!reverse,step,blocks,warm,boneSamples,vertexSamples,contactSamples,maxContacts,
    bodies:rows[0].rt.getRigidBodyCount(),dynamic:rows[0].rt.getDynamicRigidBodyCount(),bones:rows[0].mesh.skeleton.bones.length,
    modelWins:rows[1].blocks.filter((v,i)=>v<rows[0].blocks[i]).length,
    worldWins:rows[1].worldBlocks.filter((v,i)=>v<rows[0].worldBlocks[i]).length,
    rows:rows.map(r=>({alt:r.alt,ticks:r.ticks,modelMs:fmt(avg(r.times)),p95:fmt(p95(r.times)),backendMs:fmt(r.backend/r.ticks),worldMs:fmt(r.world/r.ticks),feedMs:fmt(r.feed/r.ticks),outputsMs:fmt(r.output/r.ticks),writes:r.writes/r.ticks}))},null,2));
}finally{for(const r of rows)r?.rt?.dispose();close();}
