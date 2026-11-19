import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, LatheGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** One indexed opaque surface, including the rounded normals of the source
 * pieces. No texture/material groups for small ferrules, screws or grip ribs. */
export class PaintedParts {
  private parts:BufferGeometry[]=[];
  add(g:BufferGeometry,paint?:string) {
    const count=g.getAttribute('position').count;
    if(paint){const tint=new Color(paint), colors=new Float32Array(count*3);
      for(let i=0;i<count;i++)tint.toArray(colors,i*3);
      g.setAttribute('color',new Float32BufferAttribute(colors,3));}
    if(!g.index)g.setIndex(Array.from({length:count},(_,i)=>i));
    g.deleteAttribute('uv');this.parts.push(g);
  }
  finish(){const result=mergeGeometries(this.parts,false)!;
    for(const g of this.parts)g.dispose();result.computeBoundingSphere();return result;}
}

type Point=[number,number,number];
export const turn=(profile:number[][],sides=28)=>new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y)),sides);
export const ball=(x:number,y:number,z:number,rx:number,ry:number,rz:number,sides=20)=>new SphereGeometry(1,sides,12).scale(rx,ry,rz).translate(x,y,z);
export const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>new BoxGeometry(w,h,d).translate(x,y,z);
export const ring=(r:number,tube:number,sides=28)=>new TorusGeometry(r,tube,6,sides);
export function rod(from:Point,to:Point,r:number,end=r,sides=12) {
  const a=new Vector3(...from),b=new Vector3(...to),axis=b.clone().sub(a),len=axis.length();
  const result=new CylinderGeometry(end,r,len,sides);
  result.rotateX(Math.PI/2);result.lookAt(axis.normalize());a.lerp(b,.5);return result.translate(a.x,a.y,a.z);
}

/** Rounded wire winding around local Y. No end caps hidden between turns. */
export function coil(rad:number,pitch:number,turns:number,wire:number,steps=16) {
  const pos:number[]=[], norm:number[]=[], ix:number[]=[],sides=5, count=Math.ceil(turns*steps);
  for(let i=0;i<=count;i++){
    const t=i/count, a=t*turns*2*Math.PI;
    for(let j=0;j<sides;j++){
      const b=j*2*Math.PI/sides,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
      pos.push((rad+wire*cb)*ca,(t-.5)*turns*pitch+wire*sb,(rad+wire*cb)*sa);norm.push(cb*ca,sb,cb*sa);
      if(i){const p=(i-1)*sides+j,q=(i-1)*sides+(j+1)%sides;ix.push(p,q,p+sides,q,q+sides,p+sides);}
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('normal',new Float32BufferAttribute(norm,3));g.setIndex(ix);return g;
}
