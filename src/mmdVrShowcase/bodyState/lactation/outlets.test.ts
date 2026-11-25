import { expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { makeOutletFixture } from './outletFixture.test-support';
import { createMilkOutlets, prepareMilkOutlets, type OutletDetail } from './outlets';

it('samples the posed skin and outward normal; a moving, unlabelled covering vetoes only its side',()=>{
  const {model,bones,cloth}=makeOutletFixture(),sample=createMilkOutlets(model),p=new Vector3(),n=new Vector3();
  expect(sample('left',p,n)).toBe(true);expect(p.distanceTo(new Vector3(.1,1.36,.12))).toBeLessThan(1e-6);expect(n.z).toBeCloseTo(1);
  expect(sample('right',p,n)).toBe(true);expect(p.x).toBeCloseTo(-.10);
  cloth.visible=true;const previous=p.clone();expect(sample('left',p,n)).toBe(false);expect(p.equals(previous)).toBe(true);
  bones[2].position.x=-.2;model.root.updateMatrixWorld(true);expect(sample('right',p,n)).toBe(false);expect(sample('left',p,n)).toBe(true);
  model.mesh.morphTargetInfluences![0]=1;model.root.scale.setScalar(2);model.root.rotation.y=Math.PI/2;model.root.updateMatrixWorld(true);
  expect(sample('left',p,n)).toBe(true);expect(n.x).toBeCloseTo(1);expect(p.x).toBeCloseTo(2*(.12+.014));expect(p.z).toBeCloseTo(-.2);
  model.root.visible=false;expect(sample('left',p,n,true)).toBe(false);
});

it.each(['legacy','shared'])('%s material ranges keep the moving cover separate from its underlying skin',layout=>{
  const {model,cloth}=makeOutletFixture(),{mesh,root}=model,g=mesh.geometry;
  g.setDrawRange(0,0);Object.freeze(g.drawRange);
  const proxies=g.groups.map(({start,count,materialIndex=0})=>{
    const geometry=layout==='shared'?g:new BufferGeometry().setAttribute('position',g.attributes.position).setIndex(g.index);
    const proxy=new SkinnedMesh(geometry,mesh.material[materialIndex]);
    if(layout==='shared')proxy.userData.mmdMaterialRenderProxy={materialIndex,start,count};
    else {geometry.setDrawRange(start,count);proxy.userData.mmdMaterialRenderProxy={materialIndex};}
    return proxy;
  });
  root.add(...proxies);cloth.visible=true;
  const sample=createMilkOutlets({...model,renderOrderMeshes:proxies}),p=new Vector3(),n=new Vector3();
  expect(sample('left',p,n)).toBe(false);expect(sample('right',p,n)).toBe(true);
  proxies[1].visible=false;expect(sample('left',p,n)).toBe(true);
});

it('ordinary body material requires explicit confirmation, compatible skin weights, and independent exposure',()=>{
  const {skin,model,cloth}=makeOutletFixture(),p=new Vector3(),n=new Vector3();skin.name='ActorBody2';
  const sample=createMilkOutlets(model);expect(sample('left',p,n)).toBe(false);expect(sample('left',p,n,true)).toBe(true);
  cloth.visible=true;expect(sample('left',p,n,true)).toBe(false);expect(sample('right',p,n,true)).toBe(true);
  skin.name='bodysuit';expect(createMilkOutlets(model)('right',p,n,true)).toBe(false);
  skin.name='Body';model.mesh.morphTargetDictionary={'胸':0};expect(createMilkOutlets(model)('right',p,n,true)).toBe(false);
});

it('malformed optional input cannot break model preparation or repeatedly throw in the room frame',async()=>{
  const {model}=makeOutletFixture(),p=new Vector3(),n=new Vector3(),sample=createMilkOutlets(model);
  const bones=model.mesh.skeleton.bones;model.mesh.skeleton.bones=[];
  // Malformed bind transform throws during a real palette read; retire once.
  model.mesh.skeleton.bones=[undefined!];expect(sample('left',p,n,true)).toBe(false);
  model.mesh.skeleton.bones=bones;expect(sample('left',p,n,true)).toBe(false);
  model.mesh.userData.mmdMorphs=[{englishName:17}];model.mesh.morphTargetDictionary={unknown:0};
  const skip=await prepareMilkOutlets(model,()=>false);expect(skip('left',p,n,true)).toBe(false);
});

it('binds split skin and tests every rendered sibling with its own face indices and remapped display weights',()=>{
  const {model,skin,cloth}=makeOutletFixture(),src=model.mesh;skin.name='body';cloth.visible=true;
  const groups=src.geometry.groups,parts=[skin,cloth].map((mat,i)=>{
    const g=src.geometry.clone(),group=groups[i];g.setIndex(Array.from(g.index!.array.slice(group.start,group.start+group.count)));g.clearGroups();
    const body=new SkinnedMesh(g,mat);body.bind(src.skeleton,src.bindMatrix);body.userData.mmdMorphSplitBody={morphTargetIndices:[2+i]};model.root.add(body);return body;
  });
  parts[0].morphTargetDictionary={'marker':0};parts[1].morphTargetDictionary={'slide':0};
  const moving=new Float32BufferAttribute(new Float32Array(parts[1].geometry.attributes.position.count*3),3);
  for(const i of parts[1].geometry.index!.array)moving.setX(i,-.2);
  parts[1].geometry.morphAttributes.position=[moving];src.geometry.setDrawRange(0,0);src.userData.mmdMorphSplitBodyMeshes=parts;
  src.userData.mmdMorphs=[{},{},{type:'vertex',englishName:'nipple'},{type:'vertex',englishName:'slide'}];src.morphTargetInfluences=[0,0,0,0];
  model.root.updateMatrixWorld(true);
  const d:OutletDetail={},p=new Vector3(),n=new Vector3(),sample=createMilkOutlets(model);
  expect(sample('left',p,n,true,d)).toBe(false);expect(d.state).toBe('blocked');expect(sample('right',p,n,false,d)).toBe(false);expect(d.state).toBe('confirm');
  cloth.visible=false;expect(sample('left',p,n,true,d)).toBe(true);expect(d.span).toBeCloseTo(.2);const rest=p.clone();
  src.morphTargetInfluences[2]=.8;expect(sample('left',p,n,true,d)).toBe(true);expect(p.z-rest.z).toBeCloseTo(.014*.8);
  src.morphTargetInfluences[2]=0;src.morphTargetInfluences[3]=1;cloth.visible=true;expect(sample('left',p,n,true,d)).toBe(true);expect(sample('right',p,n,true,d)).toBe(false);
  parts[0].morphTargetDictionary={};expect(createMilkOutlets(model)('left',p,n,true,d)).toBe(false);expect(d.state).toBe('missing');
});

it('a large active morph on a different panel does not consume the clear-skin triangle budget',()=>{
  const {model,cloth}=makeOutletFixture(),mesh=model.mesh,g=mesh.geometry;
  const p=[...g.attributes.position.array],n=[...g.attributes.normal.array],w=[...g.attributes.skinWeight.array],j=[...g.attributes.skinIndex.array];
  const local=[...g.morphAttributes.position![0].array],large=Array(local.length).fill(0),idx=[...g.index!.array];
  // Interleave two distant panels sharing the same material. Only ONE of
  // them moves. A mesh-wide morph radius would falsely include 25k faces.
  const at=p.length/3;for(const x of [4,8])for(const [u,v] of [[0,0],[.1,0],[0,.1]]){
    p.push(x+u,1.3+v,.12);n.push(0,0,1);w.push(1,0,0,0);j.push(2,0,0,0);local.push(0,0,0);large.push(0,x===8?10:0,0);
  }
  for(let i=0;i<25_000;i++){const t=at+(i%2)*3;idx.push(t,t+1,t+2);}g.groups[1].count+=75_000;g.setIndex(idx);
  g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('normal',new Float32BufferAttribute(n,3));
  g.setAttribute('skinWeight',new Float32BufferAttribute(w,4));g.setAttribute('skinIndex',new Uint16BufferAttribute(j,4));
  g.morphAttributes.position=[new Float32BufferAttribute(local,3),new Float32BufferAttribute(large,3)];mesh.morphTargetDictionary!['panel slide']=1;mesh.morphTargetInfluences![1]=1;
  cloth.visible=true;const sample=createMilkOutlets(model),pos=new Vector3(),axis=new Vector3();expect(sample('right',pos,axis)).toBe(true);expect(sample('left',pos,axis)).toBe(false);
});
