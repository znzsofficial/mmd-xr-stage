import { ThreeMmdLoader, type ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, PerspectiveCamera, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { fitChestCompression } from '../mmdRuntime/chestCompression';
import { createMmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import { DEFAULT_BODY_PROFILE as defaults } from './data';
import { createBodyDisplay } from './runtime';

afterEach(()=>vi.restoreAllMocks());

it('unwinds a changed VMD weight and compact split-clothing maps before each paused evaluation, even across 4 Hz setting updates',async()=>{
  const geometry=new BufferGeometry(),delta=new Float32BufferAttribute([0,0,.1],3);
  geometry.setAttribute('position',new Float32BufferAttribute([0,0,0],3));
  const mesh=new SkinnedMesh(geometry,new MeshBasicMaterial());mesh.bind(new Skeleton([]));
  mesh.morphTargetDictionary={Blink:0,'Custom shape':1,'Bone group':2};mesh.morphTargetInfluences=[.2,.3,.4];
  mesh.userData.mmdMorphs=[{type:'vertex'},{type:'vertex'},{type:'group'}];
  const root=new Group();root.add(mesh);
  const split=(indices:number[],weights:number[])=>{
    const g=geometry.clone();g.morphAttributes.position=indices.map(()=>delta);g.morphTargetsRelative=true;
    const body=new SkinnedMesh(g,mesh.material);body.bind(mesh.skeleton);body.morphTargetInfluences=weights;
    body.userData.mmdMorphSplitBody={morphTargetIndices:Uint16Array.from(indices)};root.add(body);return body;
  };
  const skin=split([1,0,2],[.28,.2,.4]),coat=split([1],[.32]),fixed=split([0],[.2]);mesh.userData.mmdMorphSplitBodyMeshes=[skin,coat,fixed];
  const raw:number[][]=[],camera=new PerspectiveCamera();let last=-1;
  // Same-time evaluation is allowed to skip a cached weight. A display leak
  // would become the next frame's input and creep toward 1 on every UI tick.
  function update(t:number){raw.push([mesh.morphTargetInfluences![1],skin.morphTargetInfluences![0],coat.morphTargetInfluences![0]]);
    if(t!==last){mesh.morphTargetInfluences![1]=.3+.1*t;last=t;}}
  vi.spyOn(ThreeMmdLoader.prototype,'loadModel').mockResolvedValue({mesh,root,runtime:{dispose(){}},update,
    outlineMeshes:[],renderOrderMeshes:[],diagnostics:{textures:[]}} as unknown as ThreeMmdModel);
  const rt=createMmdRuntimeHandle(new Scene());
  try{
    const {modelId:id}=await rt.addModel(new File(['x'],'one.pmx'));
    const shape={...defaults,morph:'Custom shape',fullness:.5,lactating:true};
    expect(rt.getBodySupport!(id)).toMatchObject({morphs:['Blink','Custom shape'],bones:false});
    expect(rt.setBodyProfile!(id,shape)).toBe(true);
    for(let n=0;n<100;n++){
      expect(rt.setBodyProfile!(id,{...shape,left:n/100,sensitivityMode:'manual',sensitivity:n/100})).toBe(false);
      rt.update(1,false,camera,1,false,0);
      expect(mesh.morphTargetInfluences[1]).toBeCloseTo(.7);expect(skin.morphTargetInfluences![0]).toBeCloseTo(.7);
      expect(coat.morphTargetInfluences![0]).toBeCloseTo(.7);expect(fixed.morphTargetInfluences).toEqual([.2]);
    }
    expect(raw[0]).toEqual([.3,.28,.32]);expect(raw.slice(1).every(x=>x[0]===.4&&x[1]===.28&&x[2]===.32)).toBe(true);
    rt.setMorphWeight(id,'Custom shape',.6);rt.update(2,false,camera,1,false,0);
    expect(mesh.morphTargetInfluences[1]).toBeCloseTo(.8);
    rt.setBodyProfile!(id,null);rt.update(2,false,camera,1,false,0);
    expect(mesh.morphTargetInfluences).toEqual([.2,.6,.4]);
    expect(skin.morphTargetInfluences).toEqual([.28,.2,.4]);expect(coat.morphTargetInfluences).toEqual([.32]);
  }finally{rt.dispose();}
});

function rig(){
  const m=new SkinnedMesh(),t=new Bone();t.name='上半身2';m.add(t);const bones=[t];
  for(const [s,k] of [['左',1],['右',-1]] as const){let p=t;
    for(const [n,x,y,z] of [['腕',k,0,0],['ひじ',k,-.4,.2],['手首',k,-.2,.2]] as const){
      const b=new Bone();b.name=s+n;b.position.set(x,y,z);p.add(b);bones.push(b);p=b;}}
  const c=new Bone();c.name='左胸';c.position.set(.75,-.72,.11);t.add(c);bones.push(c);m.updateMatrixWorld(true);m.bind(new Skeleton(bones));
  const idx=bones.indexOf(c);
  m.geometry.setAttribute('position',new Float32BufferAttribute([.79,-.74,.14, 0,0,0, .78,-.72,.16],3))
    .setAttribute('skinIndex',new Uint16BufferAttribute([idx,0,0,0,0,0,0,0,idx,0,0,0],4))
    .setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  return {m,c,t,bones};
}

it('weighted skin and clothing return to the actor’s fuller pose after release; trunk and arms stay authored',()=>{
  const {m,c,t,bones}=rig(),chest=fitChestCompression(m)!,display=createBodyDisplay(m,chest);
  const vert=(i:number)=>m.getVertexPosition(i,new Vector3()),origin=c.position.clone(),skin=vert(0),fabric=vert(2),torso=t.matrixWorld.clone();
  expect(display.support).toMatchObject({bones:true,sides:{left:true,right:false}});
  display.configure({...defaults,fullness:.5});display.apply();
  const half=vert(2);
  display.configure({...defaults,fullness:1});display.apply();
  const daily=vert(0),cloth=vert(2);
  // Check the rendered surface travel in shoulder-width units, not the scale
  // on an unweighted bone. Half travel remains a useful intermediate result.
  expect((daily.z-skin.z)/chest.width).toBeGreaterThan(.025);
  expect((cloth.z-fabric.z)/chest.width).toBeGreaterThan(.025);
  expect(half.z).toBeGreaterThan(fabric.z);expect(half.z).toBeLessThan(cloth.z);
  bones[2].rotation.y=Math.PI;m.updateMatrixWorld(true);const arms=bones.slice(1,7).map(b=>b.matrixWorld.clone());
  expect(chest.apply(0)).toBe(true);expect(vert(0).distanceTo(daily)).toBeGreaterThan(.01);
  expect(bones.slice(1,7).map(b=>b.matrixWorld)).toEqual(arms);expect(t.matrixWorld).toEqual(torso);
  chest.restore();display.restore();expect(c.position).toEqual(origin);expect(vert(0)).toEqual(skin);
  bones[2].rotation.y=0;m.updateMatrixWorld(true);
  for(let n=0;n<180;n++){chest.restore();display.restore();display.apply();chest.apply(0,1/60);}
  expect(vert(0)).toEqual(daily);expect(vert(2)).toEqual(cloth);expect(vert(1)).toEqual(new Vector3());
  chest.restore();display.configure(null);display.apply();expect(vert(0)).toEqual(skin);expect(vert(2)).toEqual(fabric);
  m.geometry.getAttribute('skinIndex').array.fill(0);expect(createBodyDisplay(m,chest).support).toMatchObject({bones:false,sides:{left:false,right:false}});
});

it('uses only a dedicated weighted branch on an incomplete skeleton, and never scales a spine or a joint carrying an arm',()=>{
  const {m,t,c,bones}=rig();for(const b of bones.slice(1,7))b.name='nonstandard';
  const d=createBodyDisplay(m,fitChestCompression(m));expect(d.support).toMatchObject({bones:true,sides:{left:false,right:false}});
  d.configure({...defaults,fullness:1});d.apply();expect(c.scale.x).toBeGreaterThan(1);d.restore();
  const wrist=bones[3];wrist.name='RightWrist';c.add(wrist);expect(createBodyDisplay(m,null).support.bones).toBe(false);
  c.name='Spine';expect(createBodyDisplay(m,null).support.bones).toBe(false);
  t.add(wrist);c.name='Breastbone';expect(createBodyDisplay(m,null).support.bones).toBe(false);
});

it('accepts a weighted LeftBreast below Breastbone without deforming the sternum',()=>{
  const {m,t,c}=rig();t.name='Breastbone';c.name='LeftBreast';
  const display=createBodyDisplay(m,null),vert=(i:number)=>m.getVertexPosition(i,new Vector3());
  const child=vert(0),sternum=vert(1),parentMatrix=t.matrixWorld.clone();
  expect(display.support.bones).toBe(true);
  display.configure({...defaults,fullness:1});display.apply();
  expect(vert(0).z).toBeGreaterThan(child.z);expect(vert(1)).toEqual(sternum);expect(t.matrixWorld).toEqual(parentMatrix);
});

// Same bilaterally weighted mesh with different local bind axes. The upper
// chest, an upper sleeve, and a half-weighted garment seam are controls.
function contours(roll:number,unit:number,reflected:boolean){
  const {m,t,c,bones}=rig(),right=new Bone();right.name='右胸';right.position.copy(c.position);right.position.x*=-1;
  c.rotation.y=roll;right.rotation.y=-roll;t.add(right);bones.push(right);
  if(reflected)c.scale.x=right.scale.x=-1;
  // Also test a rolled torso and child counter-rotation at bind. Keep the
  // same anatomical rest-point layout; this isn't a different starting pose.
  t.rotation.x=.36;
  for(const node of t.children){node.position.applyQuaternion(t.quaternion.clone().invert());node.quaternion.premultiply(t.quaternion.clone().invert());}
  for(const b of bones)b.position.multiplyScalar(unit);
  m.updateMatrixWorld(true);m.bind(new Skeleton(bones));
  const pos:number[]=[],idx:number[]=[],weights:number[]=[];
  const put=(x:number,y:number,z:number,b:Bone,w=1)=>{pos.push(x*unit,y*unit,z*unit);idx.push(bones.indexOf(b),0,0,0);weights.push(w,1-w,0,0);};
  for(const [side,b] of [[1,c],[-1,right]] as const){
    put(side*.75,-.50,.12,b);put(side*.82,-.70,.37,b);put(side*.80,-.89,.24,b);put(side*.82,-.70,.37,b,.5);
  }
  put(0,-.70,.07,t);put(1.2,-.15,.08,bones[1]);
  m.geometry.setAttribute('position',new Float32BufferAttribute(pos,3)).setAttribute('skinIndex',new Uint16BufferAttribute(idx,4)).setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const scene=new Group();scene.add(m);scene.position.set(2,3,-1);scene.rotation.set(.3,-.6,.14);scene.scale.set(.38,.65,.51);scene.updateMatrixWorld(true);
  const display=createBodyDisplay(m,fitChestCompression(m));expect(display.support.bones).toBe(true);
  const snapshot=()=>weights.filter((_,i)=>i%4===0).map((_,i)=>m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld));
  const base=snapshot(),rotation=c.quaternion.clone();
  function travel(t:number){display.configure({...defaults,fullness:t});display.apply();return snapshot().map((v,i)=>
    scene.worldToLocal(v).sub(scene.worldToLocal(base[i].clone())).divideScalar(unit));}
  const mid=travel(.5),high=travel(1);display.configure(null);display.apply();
  expect(c.quaternion.equals(rotation)).toBe(true);expect(snapshot()).toEqual(base);return {mid,high};
}

it('shapes the lower and forward sections independently of upper width, with mirrored, blended skin through rotated binds and scaled placement',()=>{
  const standard=contours(0,1,false);
  for(const [angle,unit,reflect] of [[0,1,true],[Math.PI/2,2.5,true],[.78,.35,false]] as const){
    const {mid,high}=contours(angle,unit,reflect);
    for(const [j,v] of high.slice(0,4).entries()){
      expect(high[j+4].x).toBeCloseTo(-v.x,5);expect(high[j+4].y).toBeCloseTo(v.y,5);expect(high[j+4].z).toBeCloseTo(v.z,5);
      if(angle!==.78)expect(v.distanceTo(standard.high[j])).toBeLessThan(1e-6);
    }
    const [upper,middle,lower,seam]=high;
    expect(middle.z).toBeGreaterThan(upper.z*1.4);expect(lower.z).toBeGreaterThan(upper.z*1.4);
    expect(Math.abs(middle.x)).toBeLessThan(middle.z*.35);
    expect(-lower.y).toBeGreaterThan(-upper.y*1.15);expect(lower.y).toBeLessThan(2*mid[2].y-.006);
    expect(mid[1].z).toBeGreaterThan(0);expect(mid[1].z).toBeLessThan(middle.z);
    expect(seam.distanceTo(middle.clone().multiplyScalar(.5))).toBeLessThan(1e-6);
    expect(Math.max(high[8].length(),high[9].length())).toBeLessThan(1e-8);
  }
});

it('scales instantaneous contact at the same paused timestamp, with independent release timing',()=>{
  function press(strength:number,rebound:number){
    const {m,c,bones}=rig(),chest=fitChestCompression(m)!,base=c.position.clone();
    bones[2].rotation.y=Math.PI;m.updateMatrixWorld(true);
    chest.apply(1,0,true,true,undefined,undefined,strength,rebound);
    const depth=c.position.distanceTo(base);chest.restore();
    bones[2].rotation.y=0;m.updateMatrixWorld(true);
    chest.apply(1,1/60,false,true,undefined,undefined,strength,rebound);
    return {depth,residual:c.position.distanceTo(base)};
  }
  const fast=press(1,.02),slow=press(1,.4),light=press(.25,.4);
  expect(fast.depth).toBeGreaterThan(.05);expect(slow.depth).toBeCloseTo(fast.depth,10);
  expect(light.depth).toBeCloseTo(slow.depth*.25,10);expect(slow.residual).toBeGreaterThan(fast.residual);
  expect(press(0,.4)).toEqual({depth:0,residual:0});
});
