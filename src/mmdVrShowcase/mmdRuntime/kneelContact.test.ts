import {expect,it} from 'vitest';
import {Bone,BufferGeometry,Float32BufferAttribute,MeshBasicMaterial,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {fitKneelContact} from './kneelContact';
import {measureKneeSurface} from './kneelSurface';
import {kneelFaceBudget} from './kneelFaceBudget';

const v=(x=0,y=0,z=0)=>new Vector3(x,y,z);
it('limits a further tilt or stretch relative to the already posed face, but allows common translation',()=>{
  const fraction=kneelFaceBudget(),a=v(),b=v(1,0,0),c=v(0,.16,.32),zero=v(),push=v(0,-.12,.16);
  const normal=(c:Vector3)=>v().crossVectors(b,c).normalize(),t=fraction(a,b,c,zero,zero,push,1);
  expect(t).toBeGreaterThan(0);expect(t).toBeLessThan(1);expect(normal(c).angleTo(normal(c.clone().addScaledVector(push,t)))).toBeLessThanOrEqual(Math.PI/15);
  const s=fraction(a,b,c,zero,b,zero,1);expect(s).toBeGreaterThan(.09);expect(s).toBeLessThanOrEqual(.10);
  expect(fraction(a,b,c,push,push,push,1)).toBe(1);
});
it('measures separate leg segments and ignores coplanar fabric or a point touch',()=>{
  const face=(z:number,zone:number)=>({a:v(-1,-1,z),b:v(1,-1,z),c:v(0,1,z),zone});
  const measure=measureKneeSurface([face(0,1),face(.25,3)],1),l=new Float64Array(4);
  measure(v(0,-1,-1),v(0,-1,1),v(0,2,0),l);expect([...l]).toEqual([0,2,0,2]);
  measure(v(0,1,0),v(1,2,-1),v(1,2,1),l);expect([...l]).toEqual([0,0,0,0]);
  measure(v(-.2,-.2,0),v(.2,-.2,0),v(0,.2,0),l);expect([...l]).toEqual([0,0,0,0]);
});

// Two rendered leg tubes with independent authored collision masks. One
// sparse fan dents the returned calf; an optional second sheet sits above it.
function scene(covered=false,disabled=false){
  const geometry=new BufferGeometry(),material=new MeshBasicMaterial(),mesh=new SkinnedMesh(geometry,[material,new MeshBasicMaterial()]);
  const bones:Bone[]=[],xyz:number[]=[],ids:number[]=[],weights:number[]=[],indices:number[]=[];
  function bone(name:string,parent:number,x:number,y:number){const b=new Bone();b.name=name;(bones[parent]??mesh).add(b);b.position.set(x,y,0);return bones.push(b)-1;}
  function vertex(x:number,y:number,z:number,b:number){xyz.push(x,y,z);ids.push(b,0,0,0);weights.push(1,0,0,0);return xyz.length/3-1;}
  const legs=['left','right'].map((en,s)=>{const x=s?.55:-.55,hip=bone(en+'thigh',-1,x,2),knee=bone(en+'knee',hip,0,-1);bone(en+'ankle',knee,0,-1);
    for(const [height,b] of [[2,hip],[1,knee]]){const start=xyz.length/3;
      for(let j=0;j<=8;j++)for(let k=0;k<24;k++){const phi=Math.PI*k/12;vertex(x+.2*Math.cos(phi),height-j/8,.2*Math.sin(phi),b);
        if(j<8){const i=start+j*24+k,n=start+j*24+(k+1)%24;indices.push(i,n,i+24,n,n+24,i+24);}}}
    return {hip,knee,weights:new Set([hip]),length:1,skin:{mesh,material}};});
  const skirt=bone('skirt',-1,0,0),points=[v(.55,1.17,-.5),v(.49,1.23,-.56),v(.61,1.23,-.56),v(.61,1.23,-.44),v(.49,1.23,-.44)];
  const nodes: {p:Vector3;d:Vector3;movable:boolean}[]=[],edges:{a:number;b:number;c:number}[]=[];
  const patches=[false,...(covered?[true]:[])].map(cover=>{const vertices=points.map(p=>{const pos=cover?v(p.x,1.207,p.z):p;
    const i=vertex(pos.x,pos.y,pos.z,skirt),id=nodes.push({p:pos.clone(),d:v(),movable:true})-1;return {index:i,weld:id,mask:3};});
    const faces=[0,1,2,0,2,3,0,3,4,0,4,1].map(i=>vertices[i]);for(let k=0;k<faces.length;k+=3)edges.push({a:faces[k].weld,b:faces[k+1].weld,c:faces[k+2].weld});return {mesh,vertices,faces,shown:true};});
  geometry.setIndex(indices);geometry.addGroup(0,indices.length,0);geometry.setAttribute('position',new Float32BufferAttribute(xyz,3));
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));
  mesh.userData.mmdPhysics={rigidBodies:[...legs.map(({knee},s)=>({boneIndex:knee,mode:'static',group:0,mask:disabled&&s?0:2})),{boneIndex:skirt,mode:'dynamic',mask:1,group:1}]};
  const layer=fitKneelContact(mesh,legs[0].hip,legs,new Map([[skirt,3]]),patches,nodes,edges,()=>{}),kneel=(angle:number)=>{for(const l of legs)bones[l.knee].rotation.x=angle;mesh.updateMatrixWorld(true);};
  return {layer,kneel,nodes,mesh,legs,material};
}
it('only admits a crossing folded calf fan, and invalidates on calf motion or return to standing',()=>{
  const {layer,kneel,nodes,mesh,legs,material}=scene();layer!.seed();expect(layer!.valid()).toBe(false);
  kneel(Math.PI/2);layer!.seed();expect(layer!.valid()).toBe(true);const skin=mesh.getVertexPosition(217,v());
  expect(layer!.present()).toBe(true);expect(nodes[0].d.y).toBeGreaterThan(.03);expect(mesh.getVertexPosition(217,v())).toEqual(skin);
  material.visible=false;expect(layer!.valid()).toBe(false);material.visible=true;
  mesh.skeleton.bones[legs[1].knee].rotation.x+=.08;mesh.updateMatrixWorld(true);expect(layer!.valid()).toBe(false);
  kneel(0);layer!.seed();expect(layer!.valid()).toBe(false);
});
it('defers at an independent sheet in the swept region and respects author-disabled calf contact',()=>{
  const {layer,kneel,nodes}=scene(true);kneel(Math.PI/2);layer!.seed();expect(layer!.valid()).toBe(true);expect(layer!.present()).toBe(false);
  expect(nodes.every(n=>n.d.lengthSq()===0)).toBe(true);expect(scene(false,true).layer).toBeNull();
});
