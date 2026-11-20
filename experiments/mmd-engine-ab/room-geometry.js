import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {classroomProps} from '../../src/mmdVrShowcase/scenery/ClassroomProps';
import {ROOM,CLASS_OBSTACLES,STUDENTS} from '../../src/mmdVrShowcase/scenery/ClassroomLayout';
import parquet from '../../src/mmdVrShowcase/scenery/class-floor-day.webp';
import lesson from '../../src/mmdVrShowcase/scenery/class-lesson.webp';

export function canStand(x,z){return Math.abs(x)<ROOM.w/2-.4&&Math.abs(z)<ROOM.d/2-.4&&!CLASS_OBSTACLES.some(b=>{
  const a=b.yaw??0,dx=x-b.x,dz=-z-b.z;return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<b.w/2+.22&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<b.d/2+.22;
})}
export function classroom(scene){
  const p=classroomProps(),m=Matrix.Identity();
  const mat=(name)=>{const a=new StandardMaterial(name,scene);a.specularColor.setAll(.06);return a};
  const legs=[];for(const {desk,chair} of STUDENTS){for(const [obj,h] of [[desk,.71],[chair,.42]])for(const x of [-1,1])for(const z of [-1,1])legs.push({p:[obj.x+x*obj.w*.4,h/2,obj.z+z*obj.d*.39],s:[.027,h,.027],color:'#75837d'});
    legs.push({p:[chair.x,.68,chair.z+.19],s:[.43,.18,.038],color:'#b88959'});}
  function batch(name,parts,cylinder=false){const mesh=cylinder?MeshBuilder.CreateCylinder(name,{height:1,diameter:1,tessellation:12},scene):MeshBuilder.CreateBox(name,{size:1},scene);
    mesh.material=mat(name);const matrices=new Float32Array(parts.length*16),colors=new Float32Array(parts.length*4);
    parts.forEach((b,i)=>{Matrix.ComposeToRef(Vector3.FromArray(b.s),Quaternion.FromEulerAngles(-(b.rx??0),-(b.ry??0),b.rz??0),new Vector3(b.p[0],b.p[1],-b.p[2]),m);m.copyToArray(matrices,i*16);const c=Color3.FromHexString(b.color);colors.set([c.r,c.g,c.b,1],i*4)});
    mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.thinInstanceSetBuffer('color',colors,4,true);mesh.isPickable=false;}
  batch('school woodwork',[...p.shell,...p.trim,...p.slabs,...p.veneers,...legs,...p.luminous]);batch('school hardware',p.round,true);
  const floor=MeshBuilder.CreateGround('floor',{width:ROOM.w,height:ROOM.d},scene);floor.material=mat('floor print');floor.material.diffuseTexture=new Texture(parquet,scene);
  const board=MeshBuilder.CreatePlane('lunar lesson',{width:5.8,height:1.394},scene);board.position.set(-.70,1.97,ROOM.d/2-.176);board.material=mat('board print');const map=new Texture(lesson,scene);map.vScale=.496;map.vOffset=.502;board.material.diffuseTexture=map;
  return floor;
}
