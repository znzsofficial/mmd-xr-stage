// CPU only, Node 26.12.1. The private corpus supplies the original dressed
// PMXs, material slots and captured raw Bullet poses. No assets are written.
// node scripts/bench-pose-skirt.mjs [private-corpus-directory] [paired-runs]
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire, registerHooks} from 'node:module';
import {relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Matrix4, PerspectiveCamera, Scene, Vector3} from 'three';
import {createCustomBulletMmdPhysicsBackend} from '@yohawing/three-mmd-loader/physics';
import {loadNodeBulletStage} from './node-bullet-stage.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const corpus=resolve(process.argv[2]??'local-review/verification/skirt/multi'),pairs=Number(process.argv[3]??8);
assert(Number.isInteger(pairs)&&pairs>=2);
const json=p=>JSON.parse(readFileSync(resolve(corpus,p),'utf8'));
const actors=json('private/selected.json'),ref='4f6e4f3';
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const hash=b=>createHash('sha256').update(b).digest('hex');
function actorFile(d){const b=readFileSync(d.file);assert.equal(hash(b),d.sha256,'Recording needs its original actor');return new File([b],'actor.pmx');}
let native;
const {createMmdRuntimeHandle,close}=await loadNodeBulletStage((...args)=>native=createCustomBulletMmdPhysicsBackend(...args));
const {transformSync}=createRequire(import.meta.resolve('vite'))('rolldown/utils');
const tag='?originalSkirt',hook=registerHooks({
  resolve(s,c,next){if(c.parentURL?.endsWith(tag)&&s.startsWith('.'))return {url:new URL(s+'.ts'+tag,c.parentURL).href,shortCircuit:true};return next(s,c);},
  load(url,c,next){if(!url.endsWith(tag))return next(url,c);
    const p=relative(root,fileURLToPath(url)).replaceAll('\\','/');
    const source=execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8',windowsHide:true});
    return {format:'module',source:transformSync(p,source).code,shortCircuit:true};},
});
const app=s=>import('../src/mmdVrShowcase/'+s+'.ts');
const fit=[];for(const suffix of [tag,''])fit.push((await import('../src/mmdVrShowcase/mmdRuntime/poseSkirtClearance.ts'+suffix)).fitPoseSkirt);
const q=(a,t)=>a.toSorted((x,y)=>x-y)[Math.ceil(a.length*t)-1],mean=a=>a.reduce((n,x)=>n+x,0)/a.length,fmt=x=>+x.toFixed(3);
const vec=new Vector3();
function world(mesh,i){return mesh.getVertexPosition(i,vec).applyMatrix4(mesh.matrixWorld);}
function slots(mesh,slot){const g=mesh.geometry,ids=new Set();for(const gr of g.groups)if((mesh.userData.mmdMorphSplitBody?.materialIndex??gr.materialIndex??0)===slot){for(let j=gr.start;j<gr.start+gr.count;j++)ids.add(g.index.getX(j));}return [...ids];}
// Digest the entire skin input and every displayed bone. Also sample actual
// skinned points in each named garment/leg layer, outside the timed section.
function observe(mesh,d){
  const draws=mesh.userData.mmdMorphSplitBodyMeshes?.length?mesh.userData.mmdMorphSplitBodyMeshes:[mesh];
  const attrs=[...new Set([mesh,...draws].map(m=>m.geometry.attributes.position.array))];
  const mats=[mesh.material].flat(),probes=[],legs=[],vis=mats.map(m=>[m.visible,m.opacity]);
  for(const [label,slot] of Object.entries(d.slots)){
    let count=0;for(const m of draws){const ids=slots(m,slot);if(!ids.length)continue;
      for(let i=0;i<ids.length;i+=Math.max(1,Math.floor(ids.length/32))){const pt=[m,ids[i]];probes.push(pt);if(label==='leg')legs.push(pt);count++;}}
    assert(count&&mats[slot].visible&&mats[slot].opacity>=.04,'Missing original '+label);
  }
  const points=list=>new Float64Array(list.flatMap(([m,i])=>world(m,i).toArray()));
  const bones=new Float64Array(mesh.skeleton.bones.length*16);
  const boneHash=()=>{mesh.skeleton.bones.forEach((b,i)=>bones.set(b.matrixWorld.elements,i*16));return hash(bytes(bones));};
  const positionHash=()=>{const h=createHash('sha256');for(const a of attrs)h.update(bytes(a));return h.digest('hex');};
  const original=positionHash();
  return {boneHash,original,positionHash,legs:()=>hash(bytes(points(legs))),digest:()=>{
    assert.deepEqual(mats.map(m=>[m.visible,m.opacity]),vis,'Original wardrobe changed');
    return [boneHash(),positionHash(),hash(bytes(points(probes)))].join('/');
  }};
}
const reset=(o,a)=>{o.position.fromArray(a.p);o.quaternion.fromArray(a.q);o.scale.fromArray(a.s);o.updateMatrix();};
const routes=['standing-legsUp','standing-supine','standing-thighCradle','legsUp-allFours','legsUp-standing'];
async function captured(alias){
  const d=actors[alias],rt=createMmdRuntimeHandle(new Scene());
  try{const {modelId}=await rt.addModel(actorFile(d),[],{physics:false});const {mesh,root}=rt.getModelSurface(modelId);
    const view=observe(mesh,d);
    for(const name of routes){
      const rec=json(`held/${alias==='A'?'stream':'frames'}/${alias}/${name}.json`);assert.equal(rec.sha256,d.sha256);
      const stream=Object.values(rec.frames);assert.equal(stream.length,alias==='A'?121:4);
      const timings=[[],[]],first=[[],[]],tails=[[],[]],expected=[];
      const load=f=>{reset(root,f.root);reset(mesh,f.mesh);mesh.skeleton.bones.forEach((b,j)=>reset(b,f.bones[j]));root.updateMatrixWorld(true);};
      // Correctness/priming pair is untimed in the summary; a second warm
      // pair exercises just the real call, without hashing between displays.
      const timed=alias==='A'&&!name.endsWith('standing');
      for(let pair=-2;pair<(timed?pairs:-1);pair++)for(const v of pair%2?[1,0]:[0,1]){
        let layer;const times=[];let firstMs=0;
        for(const [i,f] of stream.entries()){
          load(f);const check=pair===-2,raw=check?view.boneHash():null,leg=check?view.legs():null;
          if(!i){const t=performance.now();layer=fit[v](mesh);assert(layer);layer.seed();layer.present();firstMs=performance.now()-t;}
          else {const t=performance.now();layer.present();times.push(performance.now()-t);}
          if(check){assert.equal(view.legs(),leg,'A leg moved');const h=view.digest();if(v)assert.equal(h,expected[i],`${alias}/${name}/${i}`);else expected.push(h);
            if(name.endsWith('standing'))assert.equal(view.positionHash(),view.original,'Residual hem after standing');}
          layer.restore();
          if(check){assert.equal(view.boneHash(),raw,'Raw bones not restored');assert.equal(view.positionHash(),view.original,'Raw positions not restored');}
        }
        if(timed)assert(layer.hasField,'Inactive display was timed');layer.clear();
        if(pair>=0){first[v].push(firstMs);timings[v].push(mean(times));tails[v].push(q(times,.95));}
      }
      console.log(JSON.stringify({alias,name,matchingFrames:expected.length,...(timed&&{pairs,
        meanDisplayMs:timings.map(a=>fmt(q(a,.5))),p95DisplayMs:tails.map(a=>fmt(q(a,.5))),firstMs:first.map(a=>fmt(q(a,.5))),
        fasterPairs:timings[1].filter((x,i)=>x<timings[0][i]).length})}));
    }
  }finally{rt.dispose();}
}

// One idle and one stroked native trajectory in the same paused manual pose.
// Wrap both display layers around the same input BEFORE the next Bullet step.
async function brush(){
  const d=actors.A,file=actorFile(d),cam=new PerspectiveCamera();
  const {useMmdVrStore}=await app('mmdVrStore'),{useBackpack}=await app('backpack/store');
  const {mountPoseRoom,poseActions:a}=await app('pose/poseSession'),{firstCharacterScale}=await app('stage/loading/firstCharacterScale');
  const {handContactShape,handReferenceRadius}=await app('xr/contact/handContactProfile'),{propColliderShape}=await app('play/propColliders');
  const runs=[];let site,witness;
  for(const stroke of [false,true]){
    const park=new Matrix4().makeTranslation(0,-1000,0),hands=Array(12).fill(park),ctrl=[park,park],props=Array(8).fill(park),palm=new Matrix4().makeRotationZ(Math.PI/2);
    const rt=createMmdRuntimeHandle(new Scene(),{handColliders:()=>hands,handCollidersEnabled:()=>true,handShape:handContactShape,handColliderRadius:()=>handReferenceRadius(.08),
      controllerColliders:()=>ctrl,propColliders:()=>props,propShape:propColliderShape,poseSkirtClearance:false});let room;
    try{const {modelId:id}=await rt.addModel(file,[],{physics:true}),{mesh,root}=rt.getModelSurface(id),bones=mesh.skeleton.bones;
      rt.setModelTransform(id,{scale:firstCharacterScale(root)});
      useMmdVrStore.setState({overlayOpen:true,physicsBusy:false,physicsFatal:false,physicsEnabled:true,playing:false,duration:0});
      useBackpack.setState({entries:[{id:'p',file,kind:'model',path:'actor.pmx'}],live:{p:{runtimeId:id,visible:true,position:[0,0,0]}},selected:'p',busy:false,draft:null});
      room=mountPoseRoom({open:i=>rt.beginPose(i,0),close:i=>rt.endPose(i),dirty(reseed,target){if(reseed)rt.resetPhysics(0,target??id);}});
      const tick=()=>{rt.update(0,true,cam,1,false,1/60);root.updateMatrixWorld(true);};
      for(let i=0;i<48;i++)tick();assert(a.begin('p',id));assert(a.applyPreset('p',id,'legsUp'));a.hold('p',id);
      const view=observe(mesh,d),layers=fit.map(make=>make(mesh));for(const l of layers){l.seed();assert(l.hasField);}
      const grid=new RegExp(d.grid),bodies=mesh.userData.mmdPhysics.rigidBodies;
      const skirts=new Set(bodies.flatMap((b,i)=>grid.test(bones[b.boneIndex]?.userData.mmdBoneName??'')?[i]:[]));assert(skirts.size>0);
      const contact=()=>native.debugPhysicsContactsForRigidBodyRange(bodies.length+2,1).some(c=>skirts.has(c.rigidBodyIndexA)||skirts.has(c.rigidBodyIndexB));
      const samples=[];let hit=0;
      for(let n=-36;n<150;n++){
        if(n===0&&!site){const pt=slots(mesh,d.slots.outer).map(i=>({i,p:world(mesh,i).clone()})).sort((a,b)=>b.p.x-a.p.x);
          site=pt[0].p;witness=pt.sort((a,b)=>a.p.distanceToSquared(site)-b.p.distanceToSquared(site)).slice(0,80).map(x=>x.i);}
        if(stroke&&n>=0){const keys=[[0,.30,-.045],[9,.30,-.045],[35,-.06,.015],[50,-.09,.09],[69,.30,.11]];
          const k=keys.findIndex(x=>x[0]>=n),b=keys[k<0?keys.length-1:k],from=keys[Math.max(0,k-1)],t=k<=0?1:(n-from[0])/(b[0]-from[0]);
          hands[0]=palm.setPosition(site.x+from[1]+t*(b[1]-from[1]),site.y+from[2]+t*(b[2]-from[2]),site.z);
        }
        tick();if(n>=0&&contact())hit++;const raw=view.boneHash(),leg=view.legs();
        let shown;for(const [i,l] of layers.entries()){l.present();assert(l.hasField,'Lost manual fit during stroke');assert.equal(view.legs(),leg);const h=view.digest();
          if(i)assert.equal(h,shown,`Stroke ${stroke}, frame ${n}`);else {shown=h;if(n>=0)samples.push(witness.map(i=>world(mesh,i).clone()));}
          l.restore();assert.equal(view.boneHash(),raw);assert.equal(view.positionHash(),view.original);}
      }
      assert(!contact(),'Palm still touching after withdrawal');for(const l of layers)l.clear();a.end();runs.push({hit,samples});
    }finally{room?.dispose();rt.dispose();}
  }
  const [idle,active]=runs;assert.equal(idle.hit,0);assert(active.hit>=3,'No sustained palm/skirt contact');
  const rms=active.samples.map((pts,i)=>1000*Math.sqrt(mean(pts.map((p,j)=>p.distanceToSquared(idle.samples[i][j])))));
  const peak=Math.max(...rms.slice(0,69)),late=mean(rms.slice(-10));assert(rms[0]<1e-5,'Idle/brush poses start apart');assert(peak>5&&late<peak,'No visible deflection and return');
  console.log(JSON.stringify({palmContactFrames:active.hit,peakMm:fmt(peak),endMm:fmt(late),matchingBrushFrames:active.samples.length+idle.samples.length}));
}
try{for(const actor of Object.keys(actors))await captured(actor);await brush();}finally{hook.deregister();close();}
