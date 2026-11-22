import { Box3, Ray, Triangle, Vector3, type Material, type Object3D, type SkinnedMesh } from 'three';
import type { WandModel } from '../../play/wandSurface';

export type Side='left'|'right';
export type Draw={owner:Object3D;material:Material;start:number;end:number};
type Patch={vertices:Set<number>;center:Vector3;axis:Vector3;box:Box3};
export type Binding={draw:Draw;face:number;ids:number[];bary:Vector3;sign:number;boundary:number[];bareOnly:boolean;span:number};
const v=()=>new Vector3();
const newPatch=():Patch=>({vertices:new Set(),center:v(),axis:v(),box:new Box3()});
const anatomical=/(?:nipple|areola|乳頭|乳头|乳首|乳暈|乳晕)/i;
const covering=/(?:cover|cloth|costume|fabric|dress|suit|shirt|armor|armour|bra(?:ssiere)?\b|bikini|past(?:y|ie)|sticker|tape|shield|pierc|hide|off\b|衣|服|罩|貼|贴|隠|隱|饰|飾|ブラ|隠し|ニプレス)/i;
const splitName=(s:string)=>s.normalize('NFKC').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_\-.]/g,' ');
const isMarker=(s:string)=>anatomical.test(s)&&!covering.test(splitName(s));
function evidence(m:Material){
  const names=[m.name,m.userData.mmdMaterial?.name,m.userData.mmdMaterial?.englishName].filter((s):s is string=>typeof s==='string').map(splitName);
  if(names.some(s=>covering.test(s)))return null;
  if(names.some(s=>anatomical.test(s)))return 'explicit';
  return names.some(s=>/(?:\b(?:body|skin)(?=\b|\d)|肌|素体|素體|皮肤|皮膚|身体|身體)/i.test(s))?'body':null;
}

/** Only colour-pass draws, not shadow/outline helpers. Reject unknown topology
 * rather than dropping unseen groups from the subsequent coverage proof. */
export function materialDraws({mesh,renderOrderMeshes}:WandModel):Draw[]|null{
  const g=mesh.geometry,total=g.index?.count??g.attributes.position?.count??0,draws:Draw[]=[];
  function add(owner:Object3D,material:Material,start:number,end:number){if(material&&start<end)draws.push({owner,material,start,end});}
  if(g.drawRange.count===0){for(const proxy of renderOrderMeshes){
    if(Array.isArray(proxy.material)||proxy.geometry.attributes.position!==g.attributes.position||proxy.geometry.index!==g.index)return null;
    const {start,count}=proxy.geometry.drawRange;add(proxy,proxy.material,start,Math.min(total,start+count));
  }}else{
    const {start,count}=g.drawRange;
    if(Array.isArray(mesh.material))for(const group of g.groups)add(mesh,mesh.material[group.materialIndex??0],Math.max(start,group.start),Math.min(start+count,group.start+group.count,total));
    else add(mesh,mesh.material,start,Math.min(total,start+count));
  }
  return draws.every(d=>Number.isInteger(d.start)&&Number.isInteger(d.end)&&d.start>=0&&d.start%3===0&&d.end%3===0)?draws:null;
}

function chestWeight(mesh:SkinnedMesh,i:number,side:Side){
  const {skinWeight:w,skinIndex:j}=mesh.geometry.attributes;if(!w||!j)return 0;
  let weight=0;
  for(let k=0;k<4;k++){
    const b=mesh.skeleton.bones[j.getComponent(i,k)];if(!b)continue;
    const name=[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].filter(Boolean).join(' ').normalize('NFKC');
    if(/胸|乳|breast|bust|nipple/i.test(name)&&(side==='left'?/左|left|(?:[._-]l|\bl)\b/i:/右|right|(?:[._-]r|\br)\b/i).test(name))weight+=w.getComponent(i,k);
  }
  return weight;
}

/** Bind a barycentric point on the rendered triangles inside the narrowest
 * bilateral, localized, anatomically named vertex morph. Never a bone end,
 * body-wide morph, projected HUD point, model filename or guessed height. */
export function* fitOutlets(mesh:SkinnedMesh,draws:Draw[]){
  const g=mesh.geometry,{position:p,normal:n}=g.attributes;
  if(!p||!n||!g.morphTargetsRelative)return null;
  const attrs=g.morphAttributes.position??[],metadata=mesh.userData.mmdMorphs,markers=new Set<number>();
  if(!attrs?.length)return null;
  for(const [name,i] of Object.entries(mesh.morphTargetDictionary??{})){
    const m=metadata?.[i];if((isMarker(name)||isMarker(m?.englishName??''))&&(!m||m.type==='vertex')&&attrs?.[i])markers.add(i);
  }
  if(!markers.size||markers.size>24)return null;
  const pt=v(),nm=v();let best:{left:Patch;right:Patch;span:number;size:number}|null=null;
  for(const i of markers){
    const a=attrs[i],patches={left:newPatch(),right:newPatch()};if(a.count!==p.count)continue;
    let invalid=false;
    for(let j=0;j<a.count;j++){
      if((j&2047)===2047)yield;
      const length=nm.fromBufferAttribute(a,j).lengthSq();if(!Number.isFinite(length)){invalid=true;break;}if(length<=1e-16)continue;
      pt.fromBufferAttribute(p,j);const s=pt.x>0?patches.left:patches.right;
      if(s.vertices.size>=4096){invalid=true;break;}
      s.vertices.add(j);s.center.add(pt);s.box.expandByPoint(pt);s.axis.add(nm.fromBufferAttribute(n,j));
    }
    if(invalid||patches.left.vertices.size<5||patches.right.vertices.size<5)continue;
    for(const s of [patches.left,patches.right]){s.center.divideScalar(s.vertices.size);s.axis.normalize();}
    const {left,right}=patches,span=left.center.x-right.center.x;
    const size=Math.max(left.box.getSize(pt).length(),right.box.getSize(nm).length());
    if(!(span>0&&size>0&&size<span*.37&&left.axis.z>.4&&right.axis.z>.4&&
      Math.abs(left.center.x+right.center.x)<span*.16&&Math.abs(left.center.y-right.center.y)<span*.16&&Math.abs(left.center.z-right.center.z)<span*.16))continue;
    if(!best||best.size>size)best={...patches,span,size};
  }
  if(!best)return null;
  const index=g.index,tri=new Triangle(),bary=v(),hit=v(),ray=new Ray(),normal=v();
  function* bind(side:Side,patch:Patch,span:number){
    let result:Binding|null=null;const first=v();
    ray.origin.copy(patch.center).addScaledVector(patch.axis,span);ray.direction.copy(patch.axis).negate();
    for(const draw of draws){const kind=evidence(draw.material);if(!kind)continue;
      for(let j=draw.start;j<draw.end;j+=3){
        if((j&4095)===0)yield;
        const a=index?.getX(j)??j,b=index?.getX(j+1)??j+1,c=index?.getX(j+2)??j+2;
        if(!patch.vertices.has(a)||!patch.vertices.has(b)||!patch.vertices.has(c))continue;
        tri.a.fromBufferAttribute(p,a);tri.b.fromBufferAttribute(p,b);tri.c.fromBufferAttribute(p,c);
        if(!ray.intersectTriangle(tri.a,tri.b,tri.c,false,hit))continue;
        // A second layer moving under the same marker is ambiguous. Coplanar
        // triangles in ONE material can legitimately meet at a central vertex.
        if(result&&(result.draw!==draw||first.distanceToSquared(hit)>(span*1e-5)**2))return null;
        if(result)continue;
        if(kind==='body'&&Math.min(chestWeight(mesh,a,side),chestWeight(mesh,b,side),chestWeight(mesh,c,side))<.25)return null;
        const agreement=tri.getNormal(normal).dot(patch.axis);if(Math.abs(agreement)<.2||!tri.getBarycoord(hit,bary))return null;
        first.copy(hit);result={draw,face:j,ids:[a,b,c],bary:bary.clone(),sign:Math.sign(agreement),boundary:[],bareOnly:kind==='body',span};
      }
    }
    if(!result)return null;
    // The center of a recessed tip can be on a steep inner facet. Its overall
    // outward normal is the oriented area normal of the actual marked surface,
    // not the inner wall of its dimple. Interior edges cancel (Stokes).
    const edges=new Map<number,[number,number]>(),base=p.count;
    function edge(a:number,b:number){if(!edges.delete(b*base+a))edges.set(a*base+b,[a,b]);}
    for(let j=result.draw.start;j<result.draw.end;j+=3){if((j&4095)===0)yield;
      const a=index?.getX(j)??j,b=index?.getX(j+1)??j+1,c=index?.getX(j+2)??j+2;
      if(patch.vertices.has(a)&&patch.vertices.has(b)&&patch.vertices.has(c)){edge(a,b);edge(b,c);edge(c,a);}
    }
    if(edges.size<3||edges.size>512)return null;
    const area=v(),va=v(),vb=v();
    for(const [a,b] of edges.values()){result.boundary.push(a,b);area.add(va.fromBufferAttribute(p,a).sub(patch.center).cross(vb.fromBufferAttribute(p,b).sub(patch.center)));}
    const agree=area.normalize().dot(patch.axis);if(Math.abs(agree)<.55)return null;result.sign=Math.sign(agree);
    return result;
  }
  return {left:yield* bind('left',best.left,best.span),right:yield* bind('right',best.right,best.span)};
}
