import {BufferAttribute,type ArrayCamera,type Camera,type SphereGeometry,type Vector3} from 'three';

// Subcamera positions in WebXRManager are this frame's tracking-space views.
// The array camera itself follows the first eye; its subcamera matrixWorlds
// aren't updated with the moving XR origin until Three renders the scene.
export function moonLodEye(camera:Camera,out:Vector3){
  const rig=camera as ArrayCamera;
  if(!rig.isArrayCamera||!rig.cameras.length)return camera.getWorldPosition(out);
  out.set(0,0,0);for(const view of rig.cameras)out.add(view.position);
  out.multiplyScalar(1/rig.cameras.length);return rig.parent?rig.parent.localToWorld(out):out;
}

// Simplify just the 112 × 72 rendered shells of Ember/Frost.
function distantIndices(g:SphereGeometry){
  const near=g.index!,{widthSegments:w,heightSegments:h}=g.parameters,stride=w+1,cols=w/2,rows=h/2;
  const pos=g.attributes.position,normal=g.attributes.normal;
  function close(attr:typeof pos,a:number,b:number,c:number,d:number,limitSq:number){
    const x=attr.getX(a)+attr.getX(b)-attr.getX(c)-attr.getX(d),
      y=attr.getY(a)+attr.getY(b)-attr.getY(c)-attr.getY(d),z=attr.getZ(a)+attr.getZ(b)-attr.getZ(c)-attr.getZ(d);
    return x*x+y*y+z*z<=limitSq;
  }
  const fits=(a:number,b:number,c:number,d:number)=>close(pos,a,b,c,d,(2*.016)**2)&&close(normal,a,b,c,d,(2*.085)**2);
  // Every other row/column defines coarse triangles, each containing four
  // original triangles. An edge midpoint may be dropped only if BOTH sides
  // can triangulate the resulting outline within budget. A median then has
  // just one crossing with a source edge: the midpoint of each segment.
  const triangles:{corner:number[];mid:number[];mask:number;medians:number}[]=[],owners=new Int32Array(2*pos.count).fill(-1);
  function triangle(a:number,b:number,c:number){
    const corner=[a,b,c],mid=[(a+b)/2,(b+c)/2,(c+a)/2];let medians=0;
    for(let k=0;k<3;k++){
      const m=mid[k];if(fits(m,corner[(k+2)%3],mid[(k+1)%3],mid[(k+2)%3]))medians|=1<<k;
      if(fits(m,m,corner[k],corner[(k+1)%3]))owners[2*m+(owners[2*m]<0?0:1)]=3*triangles.length+k;
    }
    triangles.push({corner,mid,mask:7,medians});
  }
  const far:number[]=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=2*(row*stride+col),b=a+2,c=a+2*stride,d=c+2;
    if(row===0||row===rows-1||col===0||col===cols-1){
      // Copy both rows, including SphereGeometry's asymmetric polar fans.
      for(let y=2*row;y<2*row+2;y++){
        const perCell=y===0||y===h-1?3:6,offset=(y? (2*y-1)*w*3:0)+2*col*perCell;
        for(let j=0;j<2*perCell;j++)far.push(near.getX(offset+j));
      }
    }else{triangle(b,a,d);triangle(a,c,d);}
  }
  for(let i=0;i<owners.length;i+=2){
    const j=owners[i],k=owners[i+1];if(k<0)continue; // a locked edge or the unchanged polar/seam strip
    const left=triangles[Math.floor(j/3)],right=triangles[Math.floor(k/3)],lm=left.mask^(1<<(j%3)),rm=right.mask^(1<<(k%3));
    if((!lm||(lm&left.medians))&&(!rm||(rm&right.medians))){left.mask=lm;right.mask=rm;}
  }
  for(const {corner,mid,mask,medians} of triangles){
    if(!mask){far.push(...corner);continue;}
    if(mask===7){const [a,b,c]=corner,[d,e,f]=mid;far.push(a,d,f,d,b,e,f,e,c,d,e,f);continue;}
    // Split along a tested median to a retained midpoint, then along any
    // other retained edge. Adjacent triangles share exactly the same edges.
    const allowed=mask&medians,k=allowed&1?0:allowed&2?1:2,j=(k+1)%3,l=(k+2)%3;
    const a=corner[k],b=corner[j],c=corner[l],d=mid[k];
    if(mask&(1<<j))far.push(d,b,mid[j],d,mid[j],c);else far.push(d,b,c);
    if(mask&(1<<l))far.push(d,c,mid[l],d,mid[l],a);else far.push(d,c,a);
  }
  return far;
}

// All attributes, the bounding sphere, and the exact original near triangles
// stay on one geometry, with one GPU index buffer for its owner to dispose.
export function prepareDistantMoon(g:SphereGeometry){
  const near=g.index!,far=distantIndices(g),nearCount=near.count,farCount=far.length,indices=new Uint16Array(nearCount+farCount);
  indices.set(near.array);indices.set(far,nearCount);g.setIndex(new BufferAttribute(indices,1));g.setDrawRange(0,nearCount);
  // Centre distances, in metres: switch back over 12 m above the surface,
  // well before flight midpoint. The outbound threshold fits both home pads.
  return (distanceSq:number)=>{
    if(g.drawRange.start===0){if(distanceSq>=20.5**2)g.setDrawRange(nearCount,farCount);}
    else if(distanceSq<=18**2)g.setDrawRange(0,nearCount);
  };
}
