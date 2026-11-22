import { Bone, Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import type { PelvicFrame } from './contract';
import { createGarmentGuard, type Obstruction } from './garment';

afterEach(()=>vi.restoreAllMocks());
const frame=():PelvicFrame=>({world:new Matrix4(),inverse:new Matrix4(),scale:1,radiusM:.02,lengthM:.09});
const cloth=()=>new MeshBasicMaterial({name:'skirt'});
const geometry=(vertices:number[])=>new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
// Every broad-phase box includes the query, but x+y >= 2 on each triangle.
function misses(){const g=geometry([0,2,.02, 2,0,.02, 2,2,.02]);
  g.setIndex(Array.from({length:9000},(_,i)=>i%3));return new Mesh(g,cloth());}
function settle(read:()=>Obstruction){for(let i=0;i<256;i++){const r=read();if(r!=='unverified')return r;}
  throw Error('garment scan never finished');}

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
