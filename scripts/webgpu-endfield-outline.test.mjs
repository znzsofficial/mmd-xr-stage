import assert from 'node:assert/strict';
import test from 'node:test';
import { ArrayCamera, Bone, BufferGeometry, Float32BufferAttribute, MeshToonMaterial, PerspectiveCamera,
  Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector4, WebGPURenderer, WGSLNodeBuilder } from 'three/webgpu';
import { positionLocal, vec3 } from 'three/tsl';
import { replaceMmdModelMaterialsWithTsl } from '@yohawing/three-mmd-loader/webgpu';
import { installOutline, prepareOutline } from './webgpu-actor/endfieldOutline.js';
import { captureEndfieldGeometry, readEndfieldGeometry } from './webgpu-actor/endfieldGeometry.js';
import { bakeEndfieldGeometry } from './webgpu-actor/endfieldGeometry.worker.js';
import { prepareSkinTransmission } from './webgpu-actor/skinTransmission.js';
import { parsePmxSectionInventory } from '@yohawing/three-mmd-loader/parser';
import { encodeSwatch } from '../experiments/gpu-cloth/swatch.js';

const attr = (data,size) => new Float32BufferAttribute(data,size);
const roles = new Map([[0,'hair'],[1,'hair']]);
function fixture({crease=false, special=false, secondSheet=false} = {}) {
  const g = new BufferGeometry(), pos=[], normals=[], ix=[], uv=[], weights=[], ids=[], edges=[], specialMask=[];
  // A slightly tilted authored center normal in an otherwise smooth fan;
  // the two closed rings of triangles have distinct indices but coincide.
  for (let s=0; s<(secondSheet ? 2:1); s++) {
    const sign=s ? -1:1, o=s*5;
    pos.push(0,0,0, 1,0,0, 0,1,0, crease ? -.5:-1,0,crease ? .866:0, 0,-1,0);
    for (let j=0; j<5; j++) {
      const angle = j === 0 ? (crease ? 30:20) * Math.PI/180 : j === 1 ? .1:0;
      normals.push(sign*Math.sin(angle),0,Math.cos(angle)); uv.push(s+(j%2)*.5,j/4);
      weights.push(1,0,0,0); ids.push(s,0,0,0); edges.push(j===2 ? 0:1); specialMask.push(special && !j ? 1:0);
    }
    ix.push(o,o+1,o+2, o,o+2,o+3, o,o+3,o+4, o,o+4,o+1);
  }
  g.setAttribute('position',attr(pos,3)); g.setAttribute('normal',attr(normals,3)); g.setAttribute('uv',attr(uv,2));
  g.setAttribute('skinIndex',new Uint16BufferAttribute(ids,4)); g.setAttribute('skinWeight',attr(weights,4));
  g.setAttribute('mmdEdgeScale',attr(edges,1)); g.setAttribute('matricesSdefEnabled',attr(specialMask,1));
  g.setIndex(ix); g.addGroup(0,ix.length,0);
  if (secondSheet) {
    // Independently moving card. A merge by position would mix these charts,
    // bones and morph deltas at BOTH centers and all perimeter vertices.
    const delta = new Float32Array(pos.length); delta[5*3+2]=.6;
    g.morphAttributes.position=[attr(delta,3)]; g.morphTargetsRelative=true;
  }
  const materials=[true,false].map(edge=>{
    const m=new MeshToonMaterial();m.userData.mmdMaterial={flags:{edge},edgeSize:.5,edgeColor:[0,0,0,1]};return m;
  });
  const mesh=new SkinnedMesh(g,materials), bones=[new Bone(),new Bone()];mesh.add(...bones);mesh.bind(new Skeleton(bones));
  return mesh;
}

test('the baked field stays chart-local on coincident, independently weighted and morphed cards',()=>{
  const one=prepareOutline(fixture(),roles), mesh=fixture({secondSheet:true}), g=mesh.geometry;
  const N=g.attributes.normal, raw=N.array.slice(), chart=g.attributes.uv, delta=g.morphAttributes.position[0], ix=g.index;
  const two=prepareOutline(mesh,roles), dir=two.direction;
  assert.deepEqual(dir.array.slice(0,20),one.direction.array);
  assert.ok(dir.getX(0)>0 && dir.getX(0)<N.getX(0));
  assert.ok(dir.getX(5)<0 && dir.getX(5)>N.getX(5));
  for (const i of [1,2,3,4,6,7,8,9]) assert.deepEqual([...dir.array.slice(i*4,i*4+3)],[...raw.slice(i*3,i*3+3)]);
  assert.equal(dir.getW(2),0); assert.equal(two.stats.slots[0].positiveEdgeVertices,8);
  assert.equal(two.stats.slots[1].authoredEdge,false); assert.equal(two.stats.slots[1].positiveEdgeVertices,0);
  assert.equal(g.attributes.normal,N); assert.deepEqual(N.array,raw); assert.equal(g.attributes.uv,chart);
  assert.equal(g.index,ix); assert.equal(g.morphAttributes.position[0],delta);
});

test('hard panel hinges and special skin weights retain their authored direction',()=>{
  for (const config of [{crease:true},{special:true}]) {
    const mesh=fixture(config), orig=mesh.geometry.attributes.normal;
    const {direction}=prepareOutline(mesh,roles);
    assert.deepEqual(direction.array.slice(0,3), orig.array.slice(0,3));
  }
});

test('style worker uses immutable authored attributes, index, groups, edge flags and finger bind pose',async()=>{
  const mesh=fixture(), g=mesh.geometry, [root,child]=mesh.skeleton.bones;
  root.name='左中指１';child.name='左中指２';root.add(child);child.position.y=1;mesh.updateMatrixWorld(true);mesh.bind(mesh.skeleton);
  const selection=new Map([[0,'skin'],[1,'hair']]);
  const evidence=captureEndfieldGeometry(mesh,selection,[0],{});
  const original=prepareOutline(mesh,selection);
  assert.ok(prepareSkinTransmission(mesh,[0])>0);
  const expectedSkin=g.attributes.mmdSkinThinness.array.slice();
  replaceMmdModelMaterialsWithTsl(mesh,{appendOutlineGroups:true});
  g.attributes.position.array.fill(10);g.attributes.uv.array.fill(0);g.attributes.normal.array.fill(0);
  g.index.array.fill(0);g.groups[0].count=0;root.name='unknown';child.position.y=3;
  const {outline,skin}=await bakeEndfieldGeometry(structuredClone(evidence));
  assert.deepEqual(outline.directions,original.direction.array);assert.deepEqual(outline.stats,original.stats);
  assert.equal(outline.height,original.height);assert.deepEqual(skin,expectedSkin);
});

test('retiring or losing a worker leaves the same immutable snapshot usable for a new request',async()=>{
  const snapshot=captureEndfieldGeometry(fixture(),roles,[],{}),abort=new AbortController();
  let terminated=0;
  const worker={postMessage(data){assert.equal(data,snapshot);},terminate(){terminated++;}};
  const failed=readEndfieldGeometry(snapshot,abort.signal,()=>worker);worker.onerror({});
  await assert.rejects(failed,/optional style geometry/);assert.equal(worker.onmessage,null);
  const pending=readEndfieldGeometry(snapshot,abort.signal,()=>worker);abort.abort();await assert.rejects(pending,{name:'AbortError'});
  const retry=readEndfieldGeometry(snapshot,new AbortController().signal,()=>worker);
  worker.onmessage({data:await bakeEndfieldGeometry(snapshot)});assert.ok((await retry).outline.directions.length);
  assert.equal(terminated,3);
});

function charts(mode='continuous') {
  const mesh=fixture(),g=new BufferGeometry();
  const points=[[0,0,0],[1,0,0],[0,1,0],[1,0,0],[0,0,0],[0,-1,.15]];
  if(mode==='overlay')points[5]=points[2];
  if(mode==='fold')points[5]=[0,-.5,.866];
  if(mode==='third')points.push(points[0],points[1],[0,-1,-.1]);
  const n=points.length,ix=Array.from({length:n},(_,i)=>i);
  if (mode!=='disconnected' && mode!=='material') {
    // One indexed panel continues around the back of the seam; touching
    // material islands (even with matching weights) must not establish it.
    points.push([-1,0,0]);ix.push(0,2,n,5,4,n);
  }
  const normals=points.map((_,i)=>i<3 ? [.15,0,.988686] : [-.15,0,.988686]);
  const skin=new Uint16Array(points.length*4), offsets=new Float32Array(points.length*3);
  const coords=[[0,0],[1,0],[0,1],[.8,.2],[.2,.2],[.2,.8],[0,.8],[1,.8],[0,.5],[0,.5]];
  g.setAttribute('position',attr(points.flat(),3));g.setAttribute('normal',attr(normals.flat(),3));g.setIndex(ix);
  if(mode==='identicalUV'){coords[3]=coords[1];coords[4]=coords[0];}
  g.setAttribute('uv',attr(coords.slice(0,points.length).flat(),2));
  if(mode==='skin')skin[4*3]=1;
  g.setAttribute('skinIndex',new Uint16BufferAttribute(skin,4));g.setAttribute('skinWeight',attr(points.flatMap(()=>[1,0,0,0]),4));
  if(mode==='qdef')g.setAttribute('matricesQdefEnabled',attr(points.map((_,i)=>Number(i===3)),1));
  offsets[2]=offsets[3*4+2]=.2;if(mode==='morph')offsets[2]=.3;
  if(mode!=='sparse')g.morphAttributes.position=[attr(offsets,3)];
  mesh.userData.mmdMorphs=[{type:'vertex'}];mesh.morphTargetInfluences=[0];g.morphTargetsRelative=true;
  if(mode==='material'){g.addGroup(0,3,0);g.addGroup(3,3,1);}else g.addGroup(0,ix.length,0);
  mesh.geometry=g;return mesh;
}

test('unique reverse chart edge: both endpoint directions agree across distinct UVs and matching morph travel',()=>{
  const mesh=charts(),g=mesh.geometry,orig=g.attributes.normal.array.slice();
  const {direction:d,stats}=prepareOutline(mesh,roles);
  assert.equal(stats.slots[0].pairedSeamEdges,1);assert.equal(stats.slots[0].repairedSeamPairs,2);
  for (const [i,j] of [[0,4],[1,3]]) {
    assert.notDeepEqual(orig.slice(i*3,i*3+3),orig.slice(j*3,j*3+3));
    assert.deepEqual(d.array.slice(i*4,i*4+3),d.array.slice(j*4,j*4+3));
  }
  assert.deepEqual(g.attributes.normal.array,orig);
});

test('coincident cards, creases, ambiguity or uncertain deformation cannot admit a UV seam',()=>{
  for (const mode of ['overlay','disconnected','fold','third','material','skin','morph','sparse','qdef','identicalUV']) {
    const mesh=charts(mode),{direction,stats}=prepareOutline(mesh,roles);
    assert.equal(stats.slots[0].pairedSeamEdges,0,mode);
    assert.deepEqual(direction.array.slice(0,3),mesh.geometry.attributes.normal.array.slice(0,3),mode);
  }
});

test('sparse PMX: matching bind pose does not conceal a future one-sided morph',async()=>{
  const mesh=charts('sparse'),g=mesh.geometry,P=g.attributes.position,N=g.attributes.normal;
  const vertices=Array.from({length:P.count},(_,i)=>({b:0,p:[P.getX(i),P.getY(i),P.getZ(i)],normal:[N.getX(i),N.getY(i),N.getZ(i)]}));
  const base=Buffer.from(await encodeSwatch({vertices,groups:[[...g.index.array],[],[]],bone:[{name:'root',p:[0,0,0],parent:-1}],body:[],joint:[]},'chart.pmx').arrayBuffer());
  const section=parsePmxSectionInventory(base).sections.find(s=>s.name==='morphs');
  const i32=x=>{const b=Buffer.alloc(4);b.writeInt32LE(x);return b;};
  const row=(vertex,z)=>{const b=Buffer.alloc(14);b.writeUInt16LE(vertex);b.writeFloatLE(z,10);return b;};
  for (const [z,expected] of [[.2,1],[.3,0]]) {
    const pmxBytes=Buffer.concat([base.subarray(0,section.offset-4),i32(1),i32(0),i32(0),Buffer.from([1,1]),i32(2),row(0,.2),row(4,z),base.subarray(section.offset)]);
    const result=prepareOutline(mesh,roles,{pmxBytes});
    assert.equal(result.stats.slots[0].pairedSeamEdges,expected);
  }
});

function emit(mesh,material,camera) {
  // Three's CPU shader generator only: no DOM, adapter/device, init or draws.
  const r=new WebGPURenderer({canvas:{width:640,height:640}});
  r.hasFeature=()=>false; r.backend.capabilities.getUniformBufferLimit=()=>65536; r._bindings=undefined;
  const b=new WGSLNodeBuilder(mesh,r);b.material=material;b.camera=camera;b.scene=new Scene();b.build();
  return b.vertexShader;
}

test('the real loader hull skins its own direction before the later cloth position; v4 restores exact nodes and live width',()=>{
  const mesh=fixture(),g=mesh.geometry,prepared=prepareOutline(mesh,roles);
  replaceMmdModelMaterialsWithTsl(mesh,{appendOutlineGroups:true});
  const [body,noEdge,edge]=mesh.material, uniforms=edge.userData.mmdTslOutlineMaterial.uniforms;
  const v4=edge.vertexNode, setup=edge.setupPosition, groups=[...g.groups], materialList=mesh.material;
  const live=installOutline(mesh,prepared,{enabled:false});
  assert.equal(edge.vertexNode,v4);assert.equal(edge.setupPosition,setup);
  assert.equal(live.stats.slots.find(s=>s.slot===1).styledDraws,0);
  live.setEnabled(true);
  // Actual attachment order: clothSurface owns positionNode on fill and hull.
  // Substitute a known offset to identify that output in the emitted shader.
  body.positionNode=edge.positionNode=positionLocal.add(vec3(.12345,.23456,.34567));
  const cameras=[new PerspectiveCamera(),new PerspectiveCamera()];
  cameras[0].viewport=new Vector4(0,0,640,700);cameras[1].viewport=new Vector4(640,0,600,700);
  const vs=emit(mesh,edge,new ArrayCamera(cameras));
  const seed=vs.indexOf('normalLocal = endfieldEdgeDirection.xyz');
  const skin=vs.indexOf('* normalLocal',seed), cloth=vs.indexOf('0.12345',skin), clip=vs.lastIndexOf('cameraProjectionMatrices');
  assert.ok(seed>=0 && skin>seed && cloth>skin && clip>cloth,vs);
  assert.match(vs,/cameraViewports\[|cameraViewports\.value\[/);
  assert.match(vs,/endfieldEdgeDirection\.w/);
  assert.doesNotMatch(emit(mesh,body,cameras[0]),/endfieldEdgeDirection/);
  const smooth=edge.vertexNode,clothPosition=edge.positionNode; uniforms.width.value=.17;
  live.setEnabled(false);assert.equal(edge.vertexNode,v4);assert.equal(edge.setupPosition,setup);
  assert.equal(edge.positionNode,clothPosition);assert.equal(uniforms.width.value,.17);
  assert.doesNotMatch(emit(mesh,edge,cameras[0]),/endfieldEdgeDirection/);
  live.setEnabled(true);assert.equal(edge.vertexNode,smooth);live.dispose();live.dispose();
  assert.equal(mesh.material,materialList);assert.deepEqual(g.groups,groups);assert.equal(noEdge.vertexNode,null);
  assert.equal(g.hasAttribute('endfieldEdgeDirection'),false);assert.equal(edge.vertexNode,v4);
  assert.equal(edge.setupPosition,setup);assert.equal(edge.positionNode,clothPosition);assert.equal(uniforms.width.value,.17);
});
