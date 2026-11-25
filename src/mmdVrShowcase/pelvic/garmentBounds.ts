import type {Box3,Matrix4,Vector3} from 'three';

// Extreme corner along one affine row. Use the same products and addition
// order as Vector3.applyMatrix4 (a center/half-width formula rounds differently).
function edge(e:Matrix4['elements'],i:number,lo:Vector3,hi:Vector3){
  const x=e[i],y=e[i+4],z=e[i+8];
  return x*(x<0?hi.x:lo.x)+y*(y<0?hi.y:lo.y)+z*(z<0?hi.z:lo.z)+e[i+12];
}

/** The union of the current bone's transformed nonempty garment chunk and out. */
export function unionPosedBox(out:Box3,rest:Box3,m:Matrix4,tmp:Box3){
  const e=m.elements;
  if(e[3]===0&&e[7]===0&&e[11]===0&&e[15]===1){
    const {min:lo,max:hi}=rest,{min,max}=tmp;
    min.set(edge(e,0,lo,hi),edge(e,1,lo,hi),edge(e,2,lo,hi));
    max.set(edge(e,0,hi,lo),edge(e,1,hi,lo),edge(e,2,hi,lo));
    if(Number.isFinite(min.x+min.y+min.z+max.x+max.y+max.z)){out.union(tmp);return;}
  }
  out.union(tmp.copy(rest).applyMatrix4(m));
}
