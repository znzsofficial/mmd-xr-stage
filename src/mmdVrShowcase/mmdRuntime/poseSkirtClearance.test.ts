import {describe,expect,it} from 'vitest';
import {Bone,BufferGeometry,Float32BufferAttribute,MeshBasicMaterial,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {fitPoseSkirt} from './poseSkirtClearance';
import {fitSparsePoseSkirt} from './sparsePoseSkirt';

// Two independently skinned thighs and an authored three-panel overskirt.
// Bring a real leg surface through one panel without touching the skirt bones.
function fixture(label='skirt',mask=1,mode='dynamic',insideOnly=false){
  const g=new BufferGeometry(),mesh=new SkinnedMesh(g,[new MeshBasicMaterial(),new MeshBasicMaterial()]);
  const bones:Bone[]=[],add=(name:string,parent:number,x:number,y:number)=>{const b=new Bone();b.name=name;b.position.set(x,y,0);(bones[parent]??mesh).add(b);return bones.push(b)-1;};
  add('pelvis',-1,0,1);const left=add('左足',0,-.55,0);add('左ひざ',left,0,-1);const right=add('右足',0,.55,0);add('右ひざ',right,0,-1);
  for(let i=0;i<3;i++)add(`${label}-${i}`,0,0,0);
  mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));
  const xyz:number[]=[],ids:number[]=[],weights:number[]=[],index:number[]=[];
  const vertex=(x:number,y:number,z:number,b:number)=>{xyz.push(x,y,z);ids.push(b,0,0,0);weights.push(1,0,0,0);return xyz.length/3-1;};
  for(const [b,x] of [[left,-.55],[right,.55]]){const start=xyz.length/3;
    for(let row=0;row<7;row++)for(let i=0;i<24;i++){const angle=2*Math.PI*i/24;
      vertex(x+.20*Math.cos(angle),1-row/6,.20*Math.sin(angle),b);
      if(row<6){const a=start+row*24+i,c=start+row*24+(i+1)%24;index.push(a,c,a+24,c,c+24,a+24);}}
  }
  g.addGroup(0,index.length,0);const first=xyz.length/3,offset=index.length;
  index.push(vertex(-.405,.99,-.33,5),vertex(-.418,.98,-.37,6),vertex(insideOnly?-.38:-.26,1,-.40,7));
  g.addGroup(offset,3,1);const face=vertex(0,2.4,0,0);index.push(face,vertex(.1,2.3,0,0),vertex(-.1,2.3,0,0));g.addGroup(offset+3,3,0);
  g.setIndex(index);g.setAttribute('position',new Float32BufferAttribute(xyz,3));g.setAttribute('skinIndex',new Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  mesh.userData.mmdPhysics={rigidBodies:[left,right].map(boneIndex=>({boneIndex,mode:'static',group:0,mask:2})).concat([5,6,7].map(boneIndex=>({boneIndex,mode,group:1,mask}))) };
  const pose=(angle:number)=>{bones[left].rotation.x=angle;mesh.updateMatrixWorld(true);};
  const point=(i:number)=>mesh.getVertexPosition(i,new Vector3());
  return {mesh,first,face,pose,point,original:g.attributes.position.array.slice()};
}

describe('manual pose overskirt clearance',()=>{
  it('fits sparse output from original triangles, matches the native correction, and leaves all render inputs untouched',()=>{
    const {mesh,pose,first,face,original}=fixture(),g=mesh.geometry,base=g.attributes.position;
    pose(Math.PI/2);const native=fitPoseSkirt(mesh)!;
    native.seed();native.present();const reference=base.getX(first)-original[3*first];native.clear();
    const output=new Float32BufferAttribute(new Float32Array(original.length).fill(37),3);
    g.setAttribute('position',output);g.morphTargetsRelative=true;
    const edge=new MeshBasicMaterial();edge.userData.mmdTslOutlineMaterial=true;mesh.material.push(edge);
    for(const group of g.groups.slice())g.addGroup(group.start,group.count,2);
    const channel=(i:number)=>({count:base.count,getX:(v:number)=>v===i?.1:0,getY:()=>0,getZ:()=>0});
    mesh.morphTargetInfluences=[1,0];
    const layer=fitSparsePoseSkirt(mesh,{position:base,uv:g.attributes.uv,morphs:[channel(face),channel(first)],sampleable:()=>true})!;
    const offsets=()=>{const points=new Map<number,number>();layer.visitOffsets((i,x)=>points.set(i,x));return points;};
    layer.seed();layer.present();expect(offsets().get(first)).toBeCloseTo(reference,6);expect(reference).toBeGreaterThan(.035);
    expect([...offsets().keys()].every(i=>i>=first&&i<face)).toBe(true);
    layer.restore();expect(offsets().size).toBe(0);layer.present();expect(offsets().get(first)).toBeCloseTo(reference,6);
    layer.restore();mesh.morphTargetInfluences[1]=1;layer.present();expect(offsets().size).toBe(0);
    mesh.morphTargetInfluences[1]=0;layer.seed();layer.present();expect(offsets().size).toBeGreaterThan(0);
    layer.clear();pose(0);layer.seed();layer.present();expect(offsets().size).toBe(0);
    expect(base.array).toEqual(original);expect(output.array.every(x=>x===37)).toBe(true);
  });
  it.each(['dynamic','dynamicBone'])('presents bounded clearance for a %s panel, preserving leg points and withdrawing before evaluation',mode=>{
    const {mesh,first,pose,point,original}=fixture('skirt',1,mode),layer=fitPoseSkirt(mesh)!;
    expect(layer).toBeTruthy();layer.seed();layer.present();expect(mesh.geometry.attributes.position.array).toEqual(original);
    pose(Math.PI/2);const skin=Array.from({length:first},(_,i)=>point(i)),inside=point(first);
    layer.seed();layer.present();const corrected=point(first);
    expect(corrected.x).toBeGreaterThan(inside.x+.035);expect(corrected.distanceTo(inside)).toBeLessThan(.145);
    expect(skin.map((p,i)=>p.distanceTo(point(i)))).toEqual(skin.map(()=>0));
    const version=gpuVersion();function gpuVersion(){return (mesh.geometry.getAttribute('position') as Float32BufferAttribute).version;}
    for(let i=0;i<12;i++){layer.restore();expect(point(first).equals(inside)).toBe(true);layer.present();expect(point(first).equals(corrected)).toBe(true);}
    expect(gpuVersion()).toBe(version); // held raw skin: no further buffer uploads
    // A live foot drag moves the sampled skin without reseeding. Never leave
    // the previous pose's field in the new leg's path.
    layer.restore();pose(.4);layer.present();expect(point(first).equals(inside)).toBe(true);
    pose(Math.PI/2);layer.seed();layer.present();layer.clear();expect(mesh.geometry.attributes.position.array).toEqual(original);
  });
  it('declines unrelated dynamic soft parts and author-disabled collision pairs',()=>{
    expect(fitPoseSkirt(fixture('hair').mesh)).toBeNull();expect(fitPoseSkirt(fixture('pants').mesh)).toBeNull();
    expect(fitPoseSkirt(fixture('skirt',0).mesh)).toBeNull();
  });
  it('does not unfold a separate layer inside the fitted volume if the actual triangles do not cross',()=>{
    const {mesh,first,pose,point,original}=fixture('skirt',1,'dynamic',true),layer=fitPoseSkirt(mesh)!;
    pose(Math.PI/2);const raw=point(first);layer.seed();layer.present();
    expect(point(first).equals(raw)).toBe(true);expect(mesh.geometry.attributes.position.array).toEqual(original);
  });
  it('withdraws a fitted shell if its measured skin is hidden',()=>{
    const {mesh,first,pose,point}=fixture(),layer=fitPoseSkirt(mesh)!;
    pose(Math.PI/2);const raw=point(first);layer.seed();layer.present();expect(point(first).equals(raw)).toBe(false);
    mesh.material[0].visible=false;layer.present();expect(point(first).equals(raw)).toBe(true);
    mesh.material[0].visible=true;layer.present();expect(point(first).equals(raw)).toBe(true);
    layer.seed();layer.present();expect(point(first).equals(raw)).toBe(false);
  });
  it.each([true,false])('retains a face-only shape (relative=%s), revokes a real cloth morph, and restores the raw buffer',relative=>{
    const {mesh,first,face,pose,point,original}=fixture(),g=mesh.geometry;
    g.morphTargetsRelative=relative;
    const target=(i:number,dx:number)=>{const dst=new Float32BufferAttribute(relative?new Float32Array(original.length):original.slice(),3);dst.setX(i,dst.getX(i)+dx);return dst;};
    g.morphAttributes.position=[target(face,.2),target(first,.12),target(40,-.1)];mesh.updateMorphTargets();
    const layer=fitPoseSkirt(mesh)!;pose(Math.PI/2);const raw=point(first),leg=point(40),mouth=point(face);layer.seed();layer.present();
    const corrected=point(first);expect(corrected.distanceTo(raw)).toBeGreaterThan(.03);
    const w=mesh.morphTargetInfluences!;layer.restore();w[0]=relative?1:.25;layer.present();expect(point(face).distanceTo(mouth)).toBeGreaterThan(.04);
    expect(point(40).equals(leg)).toBe(true);expect(point(first).distanceTo(corrected)).toBeLessThan(2e-7);
    layer.restore();w[1]=.2;layer.present();expect(g.attributes.position.array).toEqual(original);expect(point(first).x).toBeCloseTo(raw.x+.024);
    w[1]=0;layer.seed();layer.present();expect(point(first).distanceTo(corrected)).toBeLessThan(2e-7);
    layer.restore();w[2]=.1;layer.present();expect(g.attributes.position.array).toEqual(original);
    if(!relative){w[2]=0;w[0]=1;layer.seed();layer.present();expect(g.attributes.position.array).toEqual(original);}
    layer.clear();expect(g.attributes.position.array).toEqual(original);
  });
});
