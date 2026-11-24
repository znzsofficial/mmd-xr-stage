import { Bone, Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import type { PelvicFrame } from './contract';
import { createGarmentGuard, type Obstruction } from './garment';
import {halfX,halfY,printH,printW} from './garmentPrint';
import {applyMaterialVisibility} from '../mmdRuntime/mmdRuntimeMaterials';
import {extractMaterialNames} from '../mmdRuntime/mmdRuntimeEntry';
import type {ThreeMmdModel} from '@yohawing/three-mmd-loader';

afterEach(()=>vi.restoreAllMocks());
const frame=():PelvicFrame=>({world:new Matrix4(),inverse:new Matrix4(),scale:1,radiusM:.02,lengthM:.09});
const cloth=()=>new MeshBasicMaterial({name:'skirt'});
const geometry=(vertices:number[])=>new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
// Every broad-phase box includes the query, but x+y >= 2 on each triangle.
function misses(){const g=geometry([0,2,.02, 2,0,.02, 2,2,.02]);
  g.setIndex(Array.from({length:9000},(_,i)=>i%3));return new Mesh(g,cloth());}
function settle(read:()=>Obstruction){for(let i=0;i<256;i++){const r=read();if(r!=='unverified')return r;}
  throw Error('garment scan never finished');}

it('keeps the outlet covered while the separate attachment print uncovers one side, then follows the other side',()=>{
  const f=frame(),r=f.radiusM;
  const panel=new Mesh(geometry([-.08,-.1,.012, .002,-.1,.012, .002,.1,.012, -.08,-.1,.012, .002,.1,.012, -.08,.1,.012]),cloth());
  const guard=createGarmentGuard(panel),read=()=>guard(f,true);
  const pixel=(x:number,y:number)=>guard.print()!.pixels[Math.floor((y/r/halfY+1)*printH/2)*printW+Math.floor((x/r/halfX+1)*printW/2)];
  expect(settle(read)).toBe('garment');expect([pixel(-r,0),pixel(r,0)]).toEqual([255,0]);const version=guard.print()!.version;
  expect(read()).toBe('garment');expect(guard.print()!.version).toBe(version);
  panel.position.x+=.078;expect(settle(read)).toBe('garment');expect([pixel(-r,0),pixel(r,0)]).toEqual([0,255]);
  panel.visible=false;expect(read()).toBeUndefined();expect(guard.print()).toBeNull();
});

it('can enable the larger garment print during a confirmed stroke without invalidating its outlet',()=>{
  const f=frame(),guard=createGarmentGuard(misses());expect(settle(()=>guard(f))).toBeUndefined();
  expect(guard(f,true)).toBeUndefined();expect(guard.printReady()).toBe(false);
  for(let i=0;i<8&&!guard.printReady();i++)expect(guard(f,true)).toBeUndefined();
  expect(guard.printReady()).toBe(true);expect(guard.print()?.covered).toBe(0);
});

it('reaches a blocker after 3000 misses, then proves clearance only after rechecking the moved cloth',()=>{
  const root=new Group(),last=new Mesh(geometry([-.01,-.01,.02, .01,-.01,.02, 0,.01,.02]),cloth());root.add(misses(),last);
  const probe=createGarmentGuard(root),f=frame(),tests=vi.spyOn(Box3.prototype,'intersectsTriangle');
  const read=()=>{const before=tests.mock.calls.length,r=probe(f);expect(tests.mock.calls.length-before).toBeLessThanOrEqual(1400);return r;};
  expect(read()).toBe('unverified');expect(settle(read)).toBe('garment');expect(tests.mock.calls.length).toBe(3001);
  last.position.x=1;expect(read()).toBe('unverified');expect(settle(read)).toBeUndefined();
  expect(tests.mock.calls.length).toBe(6001);expect(read()).toBeUndefined();expect(tests.mock.calls.length).toBe(6001);
});

it('never stitches different moving samples into clearance and drops completed evidence for an invalid frame',()=>{
  const f=frame(),probe=createGarmentGuard(misses());
  for(let i=0;i<24;i++){
    f.world.makeTranslation(0,(i%2)*.001,0);f.inverse.copy(f.world).invert();expect(probe(f)).toBe('unverified');
  }
  expect(settle(()=>probe(f))).toBeUndefined();f.radiusM=NaN;expect(probe(f)).toBe('unverified');
  f.radiusM=.02;expect(probe(f)).toBe('unverified');expect(settle(()=>probe(f))).toBeUndefined();
});

it('does not clear a malformed garment, and covers the entire stationary run-up even on a small actor',()=>{
  const f=frame();f.scale=.4;f.radiusM=.01;f.lengthM=.04;
  const mesh=new Mesh(geometry([-.01,-.01,.042,.01,-.01,.042,0,.01,.042]),cloth());
  const scan=createGarmentGuard(mesh);expect(settle(()=>scan(f))).toBe('garment');
  mesh.geometry.getAttribute('position').setX(1,NaN);const guard=createGarmentGuard(mesh);
  for(let i=0;i<10;i++)expect(guard(f)).toBe('unverified');
});

it.each(['padded','unnamed'] as const)('controls a %s garment by the original slot across proxies, outlines and a restore',kind=>{
  const g=geometry([-.02,-.01,.02,.02,-.01,.02,0,.02,.02]),layer=new MeshBasicMaterial({name:kind==='padded'?'  Silk lining  ':'  '});
  layer.userData.mmdMaterial={englishName:'pantyhose'};const root=new Group(),source=new SkinnedMesh(g,[new MeshBasicMaterial({name:'unrelated'}),layer]);
  const draw=new SkinnedMesh(g.clone(),layer),outline=new SkinnedMesh(g.clone(),new MeshBasicMaterial({name:'custom edge'}));root.add(source,draw,outline);
  source.geometry.setDrawRange(0,0);draw.geometry.setDrawRange(0,3);draw.userData.mmdMaterialRenderProxy={materialIndex:1};outline.userData.mmdOutlineProxy={sourceMaterialIndex:1};
  const model={root,mesh:source,outlineMeshes:[outline],renderOrderMeshes:[draw]} as unknown as ThreeMmdModel,names=extractMaterialNames(model),key=kind==='padded'?'Silk lining':'Material 2';
  const flags:Record<string,boolean>={},entry={id:'actor',visible:true,materialNames:names,materialVisible:flags,materialOverrides:{},model};
  const probe=createGarmentGuard(root,model),f=frame();expect(names[1]).toBe(key);expect(probe.garmentNames).toEqual([key]);
  expect(settle(()=>probe(f))).toBe('garment');expect(probe.blockerName()).toBe(key);
  flags[key]=false;applyMaterialVisibility(entry);expect(settle(()=>probe(f))).toBeUndefined();expect(draw.material.visible||outline.material.visible).toBe(false);
  expect(source.material[0].visible).toBe(true);flags[key]=true;applyMaterialVisibility(entry);expect(settle(()=>probe(f))).toBe('garment');expect(outline.material.visible).toBe(true);
  // A compact split carries its authored material index, not its own slot 0.
  draw.userData={mmdMorphSplitBody:{materialIndex:1,morphTargetIndices:[]}};source.userData.mmdMorphSplitBodyMeshes=[draw];
  const split=createGarmentGuard(root,model);expect(split.garmentNames).toEqual([key]);expect(settle(()=>split(f))).toBe('garment');
});

it.each(['bone','mesh world','mapped morph','visibility','query transform','query radius'] as const)(
  'discards a partially cleared prefix when %s changes in place',change=>{
    const root=new Group(),f=frame(),g=geometry([.40,-.01,.02, .42,-.01,.02, .41,.01,.02]);
    g.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(12),4));
    g.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
    g.morphTargetsRelative=true;g.morphAttributes.position=[new Float32BufferAttribute([-.41,0,0,-.41,0,0,-.41,0,0],3)];
    const mat=cloth(),panel=new SkinnedMesh(g,mat),bone=new Bone();root.add(panel);panel.add(bone);panel.bind(new Skeleton([bone]));
    // The split drawable reads weight #2 from the source, not its own #0.
    panel.userData.mmdMorphSplitBody={morphTargetIndices:[2]};
    const source=new SkinnedMesh();source.morphTargetInfluences=[0,0,0];root.add(source);
    const tail=new SkinnedMesh(misses().geometry,cloth());root.add(tail);
    source.userData.mmdMorphSplitBodyMeshes=[panel,tail];
    if(change==='visibility'){mat.visible=false;bone.position.x=-.41;}
    root.updateMatrixWorld(true);
    const guard=createGarmentGuard(root,{root,mesh:source,renderOrderMeshes:[]}),tested=vi.spyOn(Box3.prototype,'intersectsTriangle');
    for(let i=0;!tested.mock.calls.length;i++){expect(i).toBeLessThan(256);expect(guard(f)).toBe('unverified');}
    if(change==='bone')bone.position.x=-.41;
    if(change==='mesh world')panel.position.x=-.41;
    if(change==='mapped morph')source.morphTargetInfluences![2]=1;
    if(change==='visibility')mat.visible=true;
    if(change==='query transform'){f.world.makeTranslation(.41,0,0);f.inverse.copy(f.world).invert();}
    if(change==='query radius')f.radiusM=.43;
    root.updateMatrixWorld(true);expect(guard(f)).toBe('garment');
  });
