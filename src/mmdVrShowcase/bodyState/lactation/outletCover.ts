import { Box3, Ray, Triangle, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type SkinnedMesh } from 'three';
import type { createWandPose } from '../../play/wandPose';
import type { Binding, Draw } from './outletFit';

type Attr=BufferAttribute|InterleavedBufferAttribute;
type Node={box:Box3;center:Vector3;half:Vector3;joints:number[];travel:Map<Attr,number>;faces?:number[];children?:Node[]};
const v=()=>new Vector3();
function node(box:Box3,joints:Set<number>,travel:Map<Attr,number>,faces?:number[],children?:Node[]):Node{
  return {box,center:box.getCenter(v()),half:box.getSize(v()).multiplyScalar(.5),joints:[...joints],travel,faces,children};
}
function spread(x:number){x=(x|(x<<16))&0x030000ff;x=(x|(x<<8))&0x0300f00f;x=(x|(x<<4))&0x030c30c3;return (x|(x<<2))&0x09249249;}
export function shown({owner,material}:Draw){
  for(let o:typeof owner|null=owner;o;o=o.parent)if(!o.visible)return false;
  return material.visible&&material.colorWrite&&material.opacity>0;
}

/** All drawn materials (including the skin itself), both windings. No garment
 * name or rest-pose neighbourhood decides which meshes can move over the tip.
 * The convex LBS bound is valid ONLY for linear weights and relative morphs. */
export function* makeCover(mesh:SkinnedMesh,draws:Draw[],pose:ReturnType<typeof createWandPose>){
  const g=mesh.geometry,{position:p,skinIndex:ix,skinWeight:w}=g.attributes,index=g.index;
  if(!ix||!w||!mesh.skeleton?.bones.length||g.attributes.matricesSdefEnabled||g.attributes.matricesQdefEnabled)return null;
  const layers:{draw:Draw;tree:Node}[]=[],pt=v(),attrs=g.morphAttributes.position??[];
  const travelAt:(Array<{attr:Attr;d:number}>|undefined)[]=[],seen=new Set<Attr>();let nonzero=0;
  if(attrs.length*p.count>32_000_000)return null;
  for(const a of attrs){if(seen.has(a))continue;seen.add(a);
    if(a.count!==p.count)return null;
    for(let i=0;i<a.count;i++){if((i&4095)===4095)yield;const sq=pt.fromBufferAttribute(a,i).lengthSq();if(!Number.isFinite(sq))return null;
      if(sq){if(++nonzero>1_200_000)return null;(travelAt[i]??=[]).push({attr:a,d:Math.sqrt(sq)});}}
  }
  const sourceBox=new Box3();for(let i=0;i<p.count;i++){if((i&4095)===4095)yield;sourceBox.expandByPoint(pt.fromBufferAttribute(p,i));}
  const size=sourceBox.getSize(v()),lo=sourceBox.min,codes=new Uint32Array((index?.count??p.count)/3),visited=new Uint32Array(p.count);let stamp=0;
  for(const draw of draws){let children:Node[]=[];const faces:number[]=[];
    // Index order in PMX is material order, not locality. Morton order keeps
    // broad-phase leaves compact even on interleaved hair and clothing panels.
    for(let j=draw.start;j<draw.end;j+=3){if((j&2047)===0)yield;const a=index?.getX(j)??j,b=index?.getX(j+1)??j+1,c=index?.getX(j+2)??j+2;
      const x=(((p.getX(a)+p.getX(b)+p.getX(c))/3-lo.x)*1023/(size.x||1))|0,y=(((p.getY(a)+p.getY(b)+p.getY(c))/3-lo.y)*1023/(size.y||1))|0,z=(((p.getZ(a)+p.getZ(b)+p.getZ(c))/3-lo.z)*1023/(size.z||1))|0;
      codes[j/3]=spread(x)|(spread(y)<<1)|(spread(z)<<2);faces.push(j);}
    faces.sort((a,b)=>codes[a/3]-codes[b/3]);
    for(let s=0;s<faces.length;s+=24){const box=new Box3(),joints=new Set<number>(),travel=new Map<Attr,number>(),part=faces.slice(s,s+24);stamp++;
      if((children.length&15)===15)yield;
      for(const j of part)for(let k=0;k<3;k++){const i=index?.getX(j+k)??j+k;if(visited[i]===stamp)continue;visited[i]=stamp;pt.fromBufferAttribute(p,i);if(!Number.isFinite(pt.x+pt.y+pt.z))return null;
        const offsets=travelAt[i];if(offsets)for(const {attr,d} of offsets)if(d>(travel.get(attr)??0))travel.set(attr,d);
        box.expandByPoint(pt);let sum=0;
        for(let k=0;k<4;k++){const f=w.getComponent(i,k);if(!f)continue;const b=ix.getComponent(i,k);
          if(!(f>0&&mesh.skeleton.bones[b]&&mesh.skeleton.boneInverses[b]))return null;sum+=f;joints.add(b);}
        if(!(Math.abs(1-sum)<1e-4))return null;
      }
      children.push(node(box,joints,travel,part));
    }
    while(children.length>1){const parents:Node[]=[];
      for(let i=0;i<children.length;i+=4){const part=children.slice(i,i+4),box=new Box3(),joints=new Set<number>(),travel=new Map<Attr,number>();
        for(const c of part){box.union(c.box);for(const b of c.joints)joints.add(b);for(const [a,d] of c.travel)if(d>(travel.get(a)??0))travel.set(a,d);}
        parents.push(node(box,joints,travel,undefined,part));}
      children=parents;yield;
    }
    if(children.length)layers.push({draw,tree:children[0]});
  }
  const tri=new Triangle(),ray=new Ray(),hit=v(),mid=v(),extent=v(),zone=new Box3(),box=new Box3(),faceBox=new Box3();
  return function clear(bind:Binding,pos:Vector3,axis:Vector3,scale:number){
    const span=bind.span*scale,near=span*.009,far=span*.88;
    ray.origin.copy(pos).addScaledVector(axis,-near);ray.direction.copy(axis);
    zone.makeEmpty().expandByPoint(ray.origin).expandByPoint(mid.copy(pos).addScaledVector(axis,far)).expandByScalar(near);
    // Fingertip contact can alter a position buffer between samples. Include
    // its bounded on-surface depression in all broad-phase rejections.
    const padding=.006;
    let tested=0;
    function clearNode(n:Node,draw:Draw):boolean{
      let margin=0;for(const {attr,weight} of pose.active)margin+=(n.travel.get(attr)??0)*Math.abs(weight);
      box.makeEmpty();for(const i of n.joints){const b=pose.bone(i),e=b.world.elements,h=n.half;mid.copy(n.center).applyMatrix4(b.world);
        extent.set(Math.abs(e[0])*h.x+Math.abs(e[4])*h.y+Math.abs(e[8])*h.z,
          Math.abs(e[1])*h.x+Math.abs(e[5])*h.y+Math.abs(e[9])*h.z,Math.abs(e[2])*h.x+Math.abs(e[6])*h.y+Math.abs(e[10])*h.z).addScalar(margin*b.scale+padding);
        if(!Number.isFinite(mid.x+mid.y+mid.z+extent.lengthSq()))return false;
        box.expandByPoint(pt.copy(mid).sub(extent));box.expandByPoint(pt.copy(mid).add(extent));}
      if(!zone.intersectsBox(box))return true;
      if(box.distanceToPoint(pos)>near&&!ray.intersectsBox(box))return true;
      if(n.children){for(const c of n.children)if(!clearNode(c,draw))return false;return true;}
      for(const j of n.faces!){if(++tested>24_000)return false;
        if(j===bind.face&&draw===bind.draw)continue;
        const a=index?.getX(j)??j,b=index?.getX(j+1)??j+1,c=index?.getX(j+2)??j+2;
        pose.vertex(a,tri.a);pose.vertex(b,tri.b);pose.vertex(c,tri.c);
        if(!Number.isFinite(tri.a.lengthSq()+tri.b.lengthSq()+tri.c.lengthSq()))return false;
        faceBox.min.copy(tri.a).min(tri.b).min(tri.c);faceBox.max.copy(tri.a).max(tri.b).max(tri.c);
        if(!zone.intersectsBox(faceBox))continue;
        if(draw!==bind.draw&&faceBox.distanceToPoint(pos)<near&&tri.closestPointToPoint(pos,hit).distanceToSquared(pos)<near*near)return false;
        if(!ray.intersectsBox(faceBox))continue;
        if(!ray.intersectTriangle(tri.a,tri.b,tri.c,false,hit))continue;
        const dist=hit.sub(pos).dot(axis);if(dist>far)continue;
        // A triangle sharing the anchor edge/vertex can also be hit at zero
        // distance. Other sheets (even in this material) are real blockers.
        if(draw===bind.draw&&Math.abs(dist)<span*.0002&&(bind.ids.includes(a)||bind.ids.includes(b)||bind.ids.includes(c)))continue;
        return false;
      }
      return true;
    }
    for(const {draw,tree} of layers)if(shown(draw)&&!clearNode(tree,draw))return false;
    return true;
  };
}
