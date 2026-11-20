import { Bone, BufferGeometry, Float32BufferAttribute, Group, Matrix4, MeshToonMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { beginFingertipFit } from './fingertipIndent';
import { TrackedPressure } from './trackedPressure';

const fitFingertipIndent=(...args:Parameters<typeof beginFingertipFit>)=>beginFingertipFit(...args)(Infinity);

function rig(){
  // Two separated patches, an adjacent point on the first patch, an arm
  // vertex at the contact location, and the back of the bodice.
  const g=new BufferGeometry();
  const pos=new Float32BufferAttribute([0,0,0,.010,0,0,.060,0,0,0,0,0,0,.002,-.002,.064,0,0,.06,.004,0],3);
  const normal=new Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,1,0,0,1],3);
  g.setAttribute('position',pos).setAttribute('normal',normal)
    .setAttribute('skinIndex',new Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0],4))
    .setAttribute('skinWeight',new Float32BufferAttribute(Array.from({length:28},(_,i)=>+(i%4===0)),4))
    .setIndex([0,1,4,2,5,6]);
  const mesh=new SkinnedMesh(g,new MeshToonMaterial()),chest=new Bone(),arm=new Bone(),root=new Group();
  root.add(mesh);mesh.add(chest,arm);mesh.bind(new Skeleton([chest,arm]));
  const poses=Array.from({length:12},()=>new Matrix4()),hands=new TrackedPressure();
  function touch(point:Vector3,mask=2){poses[1].setPosition(point);hands.prepare(poses,mask,.033);}
  return {mesh,root,chest,arm,g,pos,normal,poses,hands,touch};
}

it('indents only the nearby front-weighted surface; slides, releases and restores exact attributes',()=>{
  const {mesh,chest,arm,pos,normal,hands,touch}=rig(),pass=fitFingertipIndent(mesh,[chest],.45)!;
  const p=pos.array.slice(),n=normal.array.slice(),armMatrix=arm.matrixWorld.clone();
  touch(new Vector3(0,0,.005));const gain=pass.apply(hands,1/60)!;
  expect(gain[1]).toBe(0);expect(pos.getZ(0)).toBeLessThan(-.001);expect(pos.getZ(1)).toBeGreaterThan(pos.getZ(0));expect(pos.getZ(1)).toBeLessThan(0);
  expect(normal.getX(1)).toBeLessThan(0);expect(pos.array.slice(6)).toEqual(p.slice(6));
  const first=pos.getZ(0);pass.restore();expect(pos.array).toEqual(p);expect(normal.array).toEqual(n);
  touch(new Vector3(.060,0,.005));pass.apply(hands,1/60);expect(pos.getZ(0)).toBeGreaterThan(first);expect(pos.getZ(2)).toBeLessThan(first*.9);
  expect(arm.matrixWorld).toEqual(armMatrix);expect(chest.scale.toArray()).toEqual([1,1,1]);
  touch(new Vector3(.060,0,.005),0);for(let i=0;i<90;i++)pass.apply(hands,1/60);
  expect(pos.array).toEqual(p);expect(normal.array).toEqual(n);
  const version=pos.version;touch(new Vector3(0,0,0),1);pass.apply(hands,1/60);expect(pos.version).toBe(version);
  touch(new Vector3(1,1,1));pass.apply(hands,1/60);expect(pos.version).toBe(version);
});

it('uses the posed, morphed split body under a rotated / scaled root; excluded buffers and shader hooks stay inert',()=>{
  const {mesh,root,chest,g,pos,hands,poses,touch}=rig(),body=new SkinnedMesh(g.clone(),mesh.material),other=new SkinnedMesh(g.clone(),mesh.material);
  root.add(body,other);body.bind(mesh.skeleton,mesh.bindMatrix);other.bind(mesh.skeleton,mesh.bindMatrix);
  other.geometry.getAttribute('skinIndex').array.fill(1);
  const p=body.geometry.getAttribute('position'),m=new Float32BufferAttribute(new Float32Array(21),3);m.setXYZ(0,.7,.2,.25);
  body.geometry.morphAttributes.position=[m];body.geometry.morphTargetsRelative=true;
  mesh.userData.mmdMorphSplitBodyMeshes=[body,other];body.userData.mmdMorphSplitBody={morphTargetIndices:[1]};
  body.morphTargetInfluences=[1];mesh.morphTargetInfluences=[0,1];
  const pass=fitFingertipIndent(mesh,[chest],.45)!;expect(pass.candidates).toBe(3);
  const hook=body.material.onBeforeCompile,raw=m.array.slice();
  for(const s of [.95,1.8]){
    root.scale.setScalar(s);root.position.set(1,2,3);root.rotation.y=.8;chest.rotation.x=.42;chest.position.y=.25;root.updateMatrixWorld(true);
    const initial=body.getVertexPosition(0,new Vector3()).applyMatrix4(body.matrixWorld),front=new Vector3(0,0,1).transformDirection(chest.matrixWorld);
    poses[1].extractRotation(chest.matrixWorld);touch(initial.clone().addScaledVector(front,.005));for(let j=0;j<12;j++)pass.apply(hands,1/60);
    const shown=body.getVertexPosition(0,new Vector3()).applyMatrix4(body.matrixWorld);
    expect(initial.distanceTo(shown)).toBeCloseTo(.0032,4);expect(shown.sub(initial).normalize().dot(front)).toBeCloseTo(-1);
    expect(p.getZ(1)).toBe(0);expect(pos.version).toBe(0);expect(other.geometry.getAttribute('position')).toMatchObject({version:0});
    pass.reset();expect(p.getZ(0)).toBe(0);
  }
  expect(m.array).toEqual(raw);expect(mesh.morphTargetInfluences).toEqual([0,1]);expect(body.material.onBeforeCompile).toBe(hook);
});

it('two tracked hands can touch separate patches without stacking displacement on coincident fingertips',()=>{
  const {mesh,chest,pos,hands,poses,touch}=rig(),pass=fitFingertipIndent(mesh,[chest],.45)!;
  touch(new Vector3(0,0,.005));pass.apply(hands,1/60);const single=pos.getZ(0);pass.reset();
  poses[7].makeTranslation(.060,0,.005);hands.prepare(poses,(1<<1)|(1<<7),.033);pass.apply(hands,1/60);
  expect(pos.getZ(0)).toBe(single);expect(pos.getZ(2)).toBeCloseTo(single,7);pass.reset();
  poses[7].copy(poses[1]);hands.prepare(poses,(1<<1)|(1<<7),.033);pass.apply(hands,1/60);
  expect(pos.getZ(0)).toBe(single);expect(pos.getZ(2)).toBe(0);
});

it('retains deep and palm pressure; unsupported nonlinear skin or excessive budgets use the original response',()=>{
  const {mesh,g,chest,pos,hands,poses,touch}=rig();const surface=fitFingertipIndent(mesh,[chest],.45)!;
  touch(new Vector3(0,0,-.04));const gain=surface.apply(hands,1/60),center=new Vector3(0,0,-.05),dir=new Vector3();
  expect(pos.getZ(0)).toBe(0);const deep=hands.overlap(center,.025,dir);expect(deep).toBeGreaterThan(0);expect(hands.overlap(center,.025,dir,gain)).toBe(deep);
  hands.prepare(poses,1,.033);const palm=hands.overlap(new Vector3(),.03,dir);expect(palm).toBeGreaterThan(0);expect(hands.overlap(new Vector3(),.03,dir,new Float32Array(12))).toBe(palm);
  g.setAttribute('matricesSdefEnabled',new Float32BufferAttribute([1,0,0,0,0],1));expect(fitFingertipIndent(mesh,[chest],.45)).toBeNull();
  g.deleteAttribute('matricesSdefEnabled');g.morphAttributes.position=[pos];g.morphTargetsRelative=false;expect(fitFingertipIndent(mesh,[chest],.45)).toBeNull();
  g.morphAttributes.position=[];pos.setX(1,1);const coarse=fitFingertipIndent(mesh,[chest],.45)!;
  touch(new Vector3(0,0,.004));expect(coarse.apply(hands,1/60)![1]).toBe(1);expect(pos.getZ(0)).toBe(0);
  g.setAttribute('position',new Float32BufferAttribute(new Float32Array(160_001*3),3));expect(fitFingertipIndent(mesh,[chest],.45)).toBeNull();
});
