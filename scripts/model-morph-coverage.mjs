// CPU-only stage regression. node scripts/model-morph-coverage.mjs <private plan.json>
// Plan: {models:[{id,path,sha256?,morphs:[PMX indices]}], routes?:['body','face','manual']}.
// Outputs, including exact name bytes and reusable one-track VMDs, are private.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Mesh, PerspectiveCamera, Scene, Vector3} from 'three';
import {FallbackCore, parseVmd} from '@yohawing/three-mmd-loader/parser';
import {loadNodeBulletStage} from './node-bullet-stage.mjs';

const out = fileURLToPath(new URL('../local-review/verification/model-coverage/', import.meta.url));
const weights = [0,.5,1,0], frames = [0,30,60,90], eps = 2e-5;
const rounded = x => Number(x.toPrecision(8));
const maxAbs = a => a.reduce((v,x) => Math.max(v,Math.abs(x)),0);
const delta = (a,b) => a.map((x,i) => x-b[i]);
const clamp = x => Math.max(0, Math.min(1,x));
const write = (name,v) => writeFileSync(join(out,name), JSON.stringify(v,null,2)+'\n');

// Reverse the platform's actual Windows-31J decoder, then check the binary
// track with the loader's own VMD parser. Never truncate a multibyte name.
const decoder = new TextDecoder('shift_jis',{fatal:true}), sjis = new Map();
function register(bytes) {
  try { const s=decoder.decode(Uint8Array.from(bytes)); if ([...s].length===1 && !sjis.has(s)) sjis.set(s,bytes); } catch { /* unassigned */ }
}
for(let i=1;i<256;i++) register([i]);
for(let hi=0x81;hi<=0xfc;hi++) if(hi<=0x9f || hi>=0xe0) for(let lo=0x40;lo<=0xfc;lo++) register([hi,lo]);
function encode(name) {
  if(!name || [...name].some(c=>!sjis.has(c))) return {reason:'empty or not exactly representable in CP932'};
  const bytes=Buffer.from([...name].flatMap(c=>sjis.get(c)));
  return bytes.length<=15 ? {bytes} : {length:bytes.length, reason:'exceeds VMD 15-byte morph field'};
}
function makeVmd(name,bytes) {
  const b=Buffer.alloc(58+23*4+16);
  b.write('Vocaloid Motion Data 0002',0,'ascii'); b.write('MorphProbe',30,'ascii'); b.writeUInt32LE(4,54);
  frames.forEach((f,i)=>{ const o=58+23*i; bytes.copy(b,o); b.writeUInt32LE(f,o+15); b.writeFloatLE(weights[i],o+19); });
  const wire=parseVmd(b);
  assert.deepEqual(Object.keys(wire.morphTracks),[name]);
  assert.deepEqual([...wire.morphTracks[name].weights],weights);
  assert.deepEqual([...wire.morphTracks[name].frames],frames);
  return b;
}

// The TS parser is ONLY the authored reference. Display data below always
// comes from the mounted stage, not from a reconstruction of its output.
function expand(morphs,index) {
  const factors=new Map();
  function visit(i,k,path) {
    assert(morphs[i] && !path.includes(i),'cyclic or invalid authored group');
    factors.set(i,(factors.get(i)??0)+k);
    const m=morphs[i];
    for(const e of m.type==='group'?m.groupOffsets:m.type==='flip'?m.flipOffsets??[]:[]) if(e.weight) visit(e.morphIndex,k*e.weight,[...path,i]);
  }
  visit(index,1,[]); return [...factors].filter(([,k])=>k!==0);
}
function drawRows(surface) {
  const split=surface.mesh.userData.mmdMorphSplitBodyMeshes??[];
  const draws=split.length?split:surface.renderOrderMeshes.length?surface.renderOrderMeshes:[surface.mesh];
  const rootIx=surface.mesh.geometry.index;
  return draws.map((draw,di)=>{
    const geo=draw.geometry, meta=draw.userData.mmdMorphSplitBody, proxy=draw.userData.mmdMaterialRenderProxy;
    const slot=meta?.materialIndex??proxy?.materialIndex??geo.groups[0]?.materialIndex??0;
    const drawMat=Array.isArray(draw.material)?draw.material[slot]:draw.material;
    const group=surface.mesh.geometry.groups.find(g=>g.materialIndex===slot);
    // Same source triangles (including loader's handedness reversal). Record
    // actual drawn indices; root is often hidden and has no morph attributes.
    const localBySource=new Map();
    if(meta && group) {
      const ix=geo.index; assert.equal(ix.count,group.count);
      for(let k=0;k<ix.count;k++) localBySource.set(rootIx.getX(group.start+k),ix.getX(k));
    } else if(group) {
      for(let k=group.start;k<group.start+group.count;k++) {const v=rootIx.getX(k); localBySource.set(v,v);}
    }
    return {di,slot,draw,drawMat,meta,localBySource};
  });
}
function magnitudeChoice(list,limit) { return list.sort((a,b)=>b.score-a.score).slice(0,limit); }
function buildProbes(model,surface,rows,index) {
  const morphs=model.morphs(), factors=expand(morphs,index), pos=new Map(), vertexOffsets=new Map(), uv=new Map(), bones=new Set(), translations=new Map(), matOps=new Map();
  const authoredMaterials=model.materials();
  for(const [i,k] of factors){ const m=morphs[i];
    for(const o of m.boneOffsets) if(maxAbs(o.translation)>1e-7||maxAbs(o.rotation.slice(0,3))>1e-7) {
      bones.add(o.boneIndex);
      const t=translations.get(o.boneIndex)??[0,0,0];
      o.translation.forEach((v,j)=>t[j]+=(j===2?-1:1)*k*v); translations.set(o.boneIndex,t);
    }
    for(const o of m.vertexOffsets){
      const d=vertexOffsets.get(o.vertexIndex)??[0,0,0];
      o.position.forEach((v,j)=>d[j]+=(j===2?-1:1)*k*v);vertexOffsets.set(o.vertexIndex,d);
      pos.set(o.vertexIndex,maxAbs(d));
    }
    for(const o of [...m.uvOffsets,...m.additionalUvOffsets]) {
      const channel=o.uvIndex===undefined?'uv':`uv${o.uvIndex+1}`, dim=channel==='uv'?2:4, key=`${channel}/${o.vertexIndex}`;
      const v=uv.get(key)??{channel,source:o.vertexIndex,offset:new Array(dim).fill(0)};
      for(let j=0;j<dim;j++) v.offset[j]+=k*o.uv[j]; uv.set(key,v);
    }
    for(const o of m.materialOffsets) {
      const slots=o.materialIndex<0?authoredMaterials.map((_,i)=>i):[o.materialIndex];
      for(const slot of slots){ if(!matOps.has(slot)) matOps.set(slot,[]); matOps.get(slot).push({k,o}); }
    }
  }
  const geom=model.geometry(), skin=geom.skinIndices, ws=geom.skinWeights, boneData=model.skeleton().bones;
  if(bones.size){
    const affected=new Set(bones);
    boneData.forEach((_,i)=>{let b=i,seen=new Set(); while(b>=0&&!seen.has(b)){if(bones.has(b)){affected.add(i);break;}seen.add(b);b=boneData[b]?.parentIndex??-1;}});
    for(let i=0;i<ws.length/4;i++){ let sum=0;for(let j=0;j<4;j++) if(affected.has(skin[i*4+j]))sum+=ws[i*4+j]; if(sum>.01&&!pos.has(i))pos.set(i,sum); }
  }
  const points=[];
  // Spread across the affected area, not just neighbouring PMX vertex IDs.
  const ranked=[...pos].filter(([,v])=>v>1e-7).sort((a,b)=>b[1]-a[1]);
  const chosen = new Set([...ranked.slice(0,8),...Array.from({length:Math.min(56,ranked.length)},(_,i)=>ranked[Math.floor(i*ranked.length/Math.min(56,ranked.length))])].map(([source])=>source));
  for(const {source} of magnitudeChoice([...vertexOffsets].map(([source,d])=>({source,score:maxAbs(d)})),16)) chosen.add(source);
  for(const source of chosen) for(const r of rows){const local=r.localBySource.get(source);if(local!==undefined){points.push({source,local,offset:vertexOffsets.get(source),...r});break;}}
  const uvPts=[];
  for(const v of magnitudeChoice([...uv.values()].map(v=>({...v,score:maxAbs(v.offset)})).filter(v=>v.score>1e-7),24)) {
    for(const r of rows){ const local=r.localBySource.get(v.source);if(local!==undefined){uvPts.push({...v,local,...r});break;} }
  }
  const mats=[];
  for(const [slot,ops] of matOps){
    const r=rows.find(r=>r.slot===slot);if(!r)continue;
    const base=authoredMaterials[slot].diffuse;
    const expected=weights.map(w=>base.map((x,c)=>{
      let mul=1,add=0; for(const {k,o} of ops) { if(o.operation==='multiply')mul*=1+k*w*(o.diffuse[c]-1);else add+=k*w*o.diffuse[c]; }
      return clamp(x*mul+add);
    }));
    const score=maxAbs(delta(expected[2],expected[0]));if(score>1e-6)mats.push({...r,expected,score});
  }
  // Evaluator may add append/IK to some local TRS. Only compare a pure
  // translation against the authored delta on targets free of these solvers.
  const ikLinks=new Set(boneData.flatMap(b=>b.ik?.links.map(l=>l.boneIndex)??[]));
  const simpleMoves=[...translations].filter(([i,t])=>maxAbs(t)>1e-7 && !boneData[i].appendTransform && !ikLinks.has(i));
  return {factors,bones:[...bones],simpleMoves,points,morphedPoints:points.filter(r=>r.offset && maxAbs(r.offset)>1e-7),uvPts,mats:magnitudeChoice(mats,24),leaves:[...new Set(factors.map(([i])=>morphs[i].type))]};
}

const vec=new Vector3();
function take(mesh,p) {
  const channels=p.factors.map(([i])=>mesh.morphTargetInfluences[i]);
  const bones=p.bones.flatMap(i=>mesh.skeleton.bones[i].matrixWorld.elements);
  const localTranslation=p.simpleMoves.flatMap(([i])=>mesh.skeleton.bones[i].position.toArray());
  const points=p.points.flatMap(r=>r.draw.getVertexPosition(r.local,vec).toArray());
  // Isolate the drawn PMX vertex child of mixed bone/vertex groups. Use
  // Three's own display accessor, immediately before SkinnedMesh applies skinning.
  const beforeSkin=p.morphedPoints.flatMap(r=>Mesh.prototype.getVertexPosition.call(r.draw,r.local,vec).toArray());
  const uv=p.uvPts.flatMap(r=>{const a=r.draw.geometry.getAttribute(r.channel);assert(a,`Missing draw attribute ${r.channel}`);return r.offset.map((_,j)=>a.getComponent(r.local,j));});
  const mats=p.mats.flatMap(({drawMat:m})=>[...m.color.toArray(),m.opacity]);
  const state={channels,bones,localTranslation,points,beforeSkin,uv,mats};
  for(const a of Object.values(state)) assert(a.every(Number.isFinite),'Non-finite output');
  return state;
}
function compare(states,p) {
  const checks={};
  function compareTo(key,expected){
    const actual=states.map(s=>s[key]);
    const errors=actual.map((a,j)=>maxAbs(delta(a,expected[j])));
    checks[key]={maxAbsDelta:actual.map(a=>rounded(maxAbs(delta(a,actual[0])))),maxError:errors.map(rounded),pass:errors.every(e=>e<=eps)};
    const candidates=expected[2].map((v,i)=>({i,score:Math.abs(v-expected[0][i])}));
    if(candidates.length){const {i}=magnitudeChoice(candidates,1)[0];checks[key].witness={i,expected:expected.map(a=>rounded(a[i])),actual:actual.map(a=>rounded(a[i]))};}
  }
  compareTo('channels',weights.map(w=>p.factors.map(([,k])=>k*w)));
  checks.channels.byIndex=p.factors.map(([index,factor],j)=>({index,expected:weights.map(w=>rounded(w*factor)),actual:states.map(s=>rounded(s.channels[j]))}));
  for(const key of ['bones','points']) if(states[0][key].length){
    const ds=states.map(s=>delta(s[key],states[0][key])),mx=ds.map(maxAbs);
    const best=magnitudeChoice(ds[2].map((x,i)=>({i,score:Math.abs(x)})),1)[0].i;
    checks[key]={count:states[0][key].length/(key==='bones'?16:3),maxAbsDelta:mx.map(rounded),
      witness:{i:best,actual:states.map(s=>rounded(s[key][best]))},pass:mx[1]>1e-6 && mx[2]>1e-6 && maxAbs(delta(ds[2],ds[1]))>1e-6 && mx[3]<=eps};
  }
  for(const [key,d] of [['uv',p.uvPts.flatMap(r=>r.offset)],['beforeSkin',p.morphedPoints.flatMap(r=>r.offset)],['localTranslation',p.simpleMoves.flatMap(([,t])=>t)]]) {
    // Bound UV attributes are Float32. At thousands of repeats even half
    // an ULP exceeds eps; compare the expected stored value, not a double.
    if(d.length) compareTo(key,weights.map(w=>states[0][key].map((x,i)=>key==='uv'?Math.fround(x+w*d[i]):x+w*d[i])));
  }
  if(p.mats.length){
    compareTo('mats',weights.map((_,j)=>p.mats.flatMap(r=>r.expected[j])));
    checks.mats.bySlot=p.mats.map(({slot,expected},j)=>({slot,expected,actual:states.map(s=>s.mats.slice(j*4,j*4+4).map(rounded))}));
  }
  return checks;
}
function witnesses(p){return {
  channels:p.factors.map(([index,factor])=>({index,factor})),boneIndices:p.bones,
  localTranslation:p.simpleMoves.map(([bone,offset])=>({bone,offset})),
  vertices:p.points.map(({source,slot,local,offset})=>({source,slot,local,offset})),
  uvs:p.uvPts.map(({source,slot,local,channel,offset,draw,meta,drawMat})=>({source,slot,local,channel,offset,
    bindPosition:vec.fromBufferAttribute(draw.geometry.attributes.position,local).toArray(),material:drawMat.name,baseOpacity:drawMat.opacity,
    // Static authored target buffer is evidence that bytes survived import;
    // it is NOT the animated bound UV attribute tested by compareTo('uv').
    staticTargetDeltas:p.factors.map(([i])=>{const li=meta?meta.morphTargetIndices.indexOf(i):i;
      const attr=draw.geometry.morphAttributes[channel]?.[li];return attr?offset.map((_,j)=>attr.getComponent(local,j)):null;})})),
  materialSlots:p.mats.map(({slot,expected})=>({slot,expectedDiffuse:expected})),
};}

const [planPath, label='run', strict]=process.argv.slice(2);
assert(planPath&&/^[\w-]+$/.test(label)&&(!strict||strict==='--strict'),'Supply <private plan.json> [output-label] [--strict]');
const plan=JSON.parse(readFileSync(planPath,'utf8'));
mkdirSync(out,{recursive:true});
const {createMmdRuntimeHandle,close}=await loadNodeBulletStage();
const report={loader:'@yohawing/three-mmd-loader',physics:false,texturesLoaded:false,frames,weights,eps,
  notes:'Positions: drawn body/proxy Three.getVertexPosition in local space (CPU bone blend, not SDEF shader). UV: bound draw attribute, not a shader/pixel claim. Materials: drawn diffuse RGB/opacity; shader-only terms not covered. Manual uses fixed frame 0 of the same VMD (or empty neutral track); not a playback test.',models:[]};
const camera=new PerspectiveCamera();
try{for(const entry of plan.models){
  assert(/^[\w-]+$/.test(entry.id));
  const bytes=readFileSync(entry.path),hash=createHash('sha256').update(bytes).digest('hex');
  if(entry.sha256)assert.equal(hash,entry.sha256,'PMX has changed');
  const authored=new FallbackCore().loadModel(bytes), rt=createMmdRuntimeHandle(new Scene());
  try{
    const {modelId}=await rt.addModel(new File([bytes],basename(entry.path)),[],{physics:false,transform:{scale:1}});
    const surface=rt.getModelSurface(modelId),mesh=surface.mesh,rows=drawRows(surface);
    const rec={id:entry.id,inventoryId:entry.inventoryId,path:entry.path,sha256:hash,runtime:surface.runtime.constructor.name,core:surface.diagnostics.core,cases:[]}; report.models.push(rec);
    const morphs=authored.morphs();
    for(const index of entry.morphs){
      const m=morphs[index], p=buildProbes(authored,surface,rows,index);
      const names=[...new Set([m.name,m.englishName].filter(Boolean))].map(name=>({name,...encode(name),mapsTo:mesh.morphTargetDictionary[name]}));
      const pick=names.find(n=>n.bytes && n.mapsTo===index);
      const c={index,name:m.name,type:m.type,childTypes:p.leaves,names:names.map(({bytes,...n})=>({...n,hex:bytes?.toString('hex')})),
        selectedName:pick?.name,witnesses:witnesses(p),runs:[]};rec.cases.push(c);
      const vmd=pick?makeVmd(pick.name,pick.bytes):makeVmd('NoMatchProbe',Buffer.from('NoMatchProbe'));
      if(!pick) assert.equal(mesh.morphTargetDictionary.NoMatchProbe,undefined);
      const fileName=`morph-${entry.id}-${index}.vmd`;
      if(pick){writeFileSync(join(out,fileName),vmd);c.vmd=fileName;}
      for(const route of plan.routes??['body','face',...(!pick?['controlled-track']:[]),'manual']){
        assert(['body','face','controlled-track','manual'].includes(route)); if(!pick && (route==='body'||route==='face')){c.runs.push({route,skip:'No unambiguous 15-byte name'});continue;}
        const slot=route==='manual'?'face':route;
        if(route==='controlled-track') {
          // Same packed track representation that the face-only stage binding
          // selects. This is not evidence of a valid VMD name or file import.
          const neutral=parseVmd(vmd);
          surface.setAnimation({...neutral,bytes:new Uint8Array(0),morphTracks:{[m.name]:Object.values(neutral.morphTracks)[0]}});
        } else await rt.loadMotion(new File([vmd],fileName),slot,modelId);
        const states=[];
        for(let j=0;j<weights.length;j++){
          if(route==='manual')rt.setMorphWeight(modelId,m.name,weights[j]);
          rt.update(route==='manual'?0:frames[j]/30,false,camera,1,false);
          states.push(take(mesh,p));
        }
        const checks=compare(states,p);
        const unmeasured=p.leaves.filter(t=>({vertex:!checks.beforeSkin,bone:!checks.bones,uv:!checks.uv,additionalUv:!checks.uv,material:!checks.mats,impulse:true,unknown:true})[t]);
        const pass=Object.keys(checks).length>1 && !unmeasured.length && Object.values(checks).every(v=>v.pass);
        c.runs.push({route,pass,unmeasured,checks}); if(!pass && strict==='--strict')process.exitCode=1;
        if(route==='controlled-track')surface.runtime.clearAnimation();else rt.clearMotion(modelId,slot);
      }
      write(`morph-${label}.json`,report);
      console.log(entry.id,index,c.runs.map(r=>[r.route,r.skip??Object.entries(r.checks).map(([k,v])=>`${k}:${v.pass?'ok':'miss'}`).join(',')].join('=' )).join(' '));
    }
  }finally{rt.dispose();authored.dispose?.();}
}}finally{close();}
